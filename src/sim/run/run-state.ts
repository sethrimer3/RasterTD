/**
 * A "run" — one attempt at a level. Waves spawn (each larger, faster, heavier),
 * enemies are shoved around by towers, and the run ends when base health hits 0.
 * Enemies have no health: they leave play only by being pushed off the track
 * (paying a bounty) or by reaching the base (hurting it).
 */

import type { TierId } from '../../data/tiers';
import type { LevelDefinition, Point } from '../../data/levels';
import type { EnemyKindId } from '../../data/enemies';
import { ENEMY_KIND_BY_ID } from '../../data/enemies';
import {
  WAVE_BASE_ENEMY_COUNT,
  WAVE_COUNT_GROWTH,
  WAVE_MASS_GROWTH,
  WAVE_SPEED_GROWTH,
  WAVE_SPAWN_INTERVAL_MS,
  WAVE_INTERMISSION_MS,
  BRUTE_WAVE_INTERVAL,
  ENEMY_BASE_SPEED,
  ENEMY_BASE_DAMAGE,
  STARTING_MONEY,
  WAVE_CLEAR_BONUS,
} from '../../data/balance';
import type { Enemy, PathGeometry } from '../enemies';
import { spawnEnemy, stepEnemy, applyShieldAura, buildPathGeometry } from '../enemies';
import type { Tower, TowerFx } from '../towers';

export type RunPhase = 'intermission' | 'spawning' | 'wave-active' | 'defeat';

interface QueuedEnemy {
  kindId: EnemyKindId;
}

export interface DeathFx {
  x: number;
  y: number;
  tierId: TierId;
  big: boolean;
}

/** Particle-burst tint per enemy kind. */
const KIND_FX_TIER: Record<EnemyKindId, TierId> = {
  grunt: 'sand',
  runner: 'citrine',
  heavy: 'iolite',
  shielder: 'sapphire',
  freezer: 'diamond',
  brute: 'ruby',
};

export interface RunState {
  levelId: string;
  difficultyMult: number;
  waypointsPx: Point[];
  geo: PathGeometry;
  basePos: Point;
  baseHealth: number;
  baseMaxHealth: number;
  phase: RunPhase;
  /** 1-based; 0 before the first wave. */
  waveIndex: number;
  highestWaveThisRun: number;
  enemies: Enemy[];
  towers: Tower[];
  nextTowerId: number;
  money: number;
  spawnQueue: QueuedEnemy[];
  spawnTimerMs: number;
  intermissionTimerMs: number;
  nextEnemyId: number;
  /** Wave-scoped enemy scaling, set by startNextWave. */
  waveSpeedBase: number;
  waveMassScale: number;
  /** Consumed by the renderer each frame. */
  deathFx: DeathFx[];
  fx: TowerFx[];
}

export function resolveWaypointsPx(
  level: LevelDefinition,
  fieldW: number,
  fieldH: number,
): Point[] {
  return level.waypoints.map((p) => ({ x: p.x * fieldW, y: p.y * fieldH }));
}

export function createRun(
  level: LevelDefinition,
  fieldW: number,
  fieldH: number,
  baseHealthBonus: number,
): RunState {
  const waypointsPx = resolveWaypointsPx(level, fieldW, fieldH);
  const maxHealth = level.baseHealth + baseHealthBonus;
  return {
    levelId: level.id,
    difficultyMult: level.difficultyMult,
    waypointsPx,
    geo: buildPathGeometry(waypointsPx),
    basePos: waypointsPx[waypointsPx.length - 1]!,
    baseHealth: maxHealth,
    baseMaxHealth: maxHealth,
    phase: 'intermission',
    waveIndex: 0,
    highestWaveThisRun: 0,
    enemies: [],
    towers: [],
    nextTowerId: 1,
    money: STARTING_MONEY,
    spawnQueue: [],
    spawnTimerMs: 0,
    intermissionTimerMs: WAVE_INTERMISSION_MS,
    nextEnemyId: 1,
    waveSpeedBase: ENEMY_BASE_SPEED,
    waveMassScale: 1,
    deathFx: [],
    fx: [],
  };
}

/** Rebuild path-derived data after a resize. */
export function rebuildRunGeometry(run: RunState, waypointsPx: Point[]): void {
  run.waypointsPx = waypointsPx;
  run.geo = buildPathGeometry(waypointsPx);
  run.basePos = waypointsPx[waypointsPx.length - 1]!;
}

/** Kind mix for wave `w`; distribution widens as waves climb. */
function waveComposition(w: number, count: number): EnemyKindId[] {
  const out: EnemyKindId[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (w >= 4 && r < 0.12) out.push('shielder');
    else if (w >= 5 && r < 0.2) out.push('freezer');
    else if (w >= 3 && r < 0.34) out.push('heavy');
    else if (w >= 2 && r < 0.5) out.push('runner');
    else out.push('grunt');
  }
  if (w % BRUTE_WAVE_INTERVAL === 0) out.push('brute');
  return out;
}

/** Build the spawn queue for the next wave and enter the spawning phase. */
export function startNextWave(run: RunState): void {
  const w = run.waveIndex + 1;
  run.waveIndex = w;

  const count = Math.ceil(
    WAVE_BASE_ENEMY_COUNT * Math.pow(WAVE_COUNT_GROWTH, w - 1) * run.difficultyMult,
  );
  run.waveSpeedBase = ENEMY_BASE_SPEED * Math.pow(WAVE_SPEED_GROWTH, w - 1);
  run.waveMassScale = Math.pow(WAVE_MASS_GROWTH, w - 1) * run.difficultyMult;

  run.spawnQueue = waveComposition(w, count).map((kindId) => ({ kindId }));
  run.spawnTimerMs = 0;
  run.phase = 'spawning';
}

/** Advance the run by `dtMs`. Tower forces must be applied by the caller first. */
export function tickRun(run: RunState, dtMs: number): { defeated: boolean } {
  if (run.phase === 'defeat') return { defeated: false };

  if (run.phase === 'intermission') {
    run.intermissionTimerMs -= dtMs;
    if (run.intermissionTimerMs <= 0) startNextWave(run);
  }

  if (run.phase === 'spawning') {
    run.spawnTimerMs -= dtMs;
    while (run.spawnTimerMs <= 0 && run.spawnQueue.length > 0) {
      const q = run.spawnQueue.shift()!;
      run.enemies.push(
        spawnEnemy(
          run.nextEnemyId++,
          q.kindId,
          run.geo,
          run.waveSpeedBase,
          run.waveMassScale,
        ),
      );
      run.spawnTimerMs += WAVE_SPAWN_INTERVAL_MS;
    }
    if (run.spawnQueue.length === 0) run.phase = 'wave-active';
  }

  applyShieldAura(run.enemies);

  for (const e of run.enemies) {
    if (e.dead) continue;

    // Freezer self-freeze cycle.
    const def = ENEMY_KIND_BY_ID.get(e.kindId);
    if (def?.selfFreeze && e.frozenMs <= 0) {
      e.freezeCooldownMs -= dtMs;
      if (e.freezeCooldownMs <= 0) {
        e.frozenMs = def.selfFreeze.durationMs;
        e.freezeCooldownMs = def.selfFreeze.everyMs;
      }
    }

    const res = stepEnemy(e, run.geo, dtMs);
    if (res.offTrack) {
      e.dead = true;
      run.money += Math.round(e.bounty);
      run.deathFx.push({
        x: e.x,
        y: e.y,
        tierId: KIND_FX_TIER[e.kindId],
        big: e.kindId === 'brute',
      });
    } else if (res.reachedBase) {
      e.dead = true;
      run.baseHealth -= ENEMY_BASE_DAMAGE;
      run.deathFx.push({
        x: run.basePos.x,
        y: run.basePos.y,
        tierId: KIND_FX_TIER[e.kindId],
        big: e.kindId === 'brute',
      });
    }
  }
  if (run.enemies.some((e) => e.dead)) {
    run.enemies = run.enemies.filter((e) => !e.dead);
  }

  if (run.baseHealth <= 0) {
    run.baseHealth = 0;
    run.phase = 'defeat';
    return { defeated: true };
  }

  if (
    run.phase === 'wave-active' &&
    run.enemies.length === 0 &&
    run.spawnQueue.length === 0
  ) {
    run.highestWaveThisRun = Math.max(run.highestWaveThisRun, run.waveIndex);
    run.money += WAVE_CLEAR_BONUS;
    run.phase = 'intermission';
    run.intermissionTimerMs = WAVE_INTERMISSION_MS;
  }

  return { defeated: false };
}

/** Enemies still alive or queued for the current wave. */
export function enemiesRemaining(run: RunState): number {
  return run.enemies.length + run.spawnQueue.length;
}
