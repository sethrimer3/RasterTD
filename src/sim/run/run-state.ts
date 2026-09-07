/**
 * A "run" — one attempt at a level. Waves spawn (each exponentially harder),
 * enemies walk the path to the base, and the run ends when base health hits 0.
 * The highest wave cleared this run drives the prestige payout on exit.
 */

import type { TierId } from '../../data/tiers';
import { VISIBLE_TIERS } from '../../data/tiers';
import type { LevelDefinition, Point } from '../../data/levels';
import {
  WAVE_BASE_ENEMY_COUNT,
  WAVE_COUNT_GROWTH,
  WAVE_HP_GROWTH,
  WAVE_SPEED_GROWTH,
  WAVE_SPAWN_INTERVAL_MS,
  WAVE_INTERMISSION_MS,
  ENEMY_BASE_HP,
  ENEMY_BASE_SPEED,
  ENEMY_BASE_DAMAGE,
} from '../../data/balance';
import type { Enemy } from '../enemies';
import { spawnEnemy, advanceEnemy } from '../enemies';

export type RunPhase = 'intermission' | 'spawning' | 'wave-active' | 'defeat';

interface QueuedEnemy {
  hp: number;
  speed: number;
  tierId: TierId;
}

export interface DeathFx {
  x: number;
  y: number;
  tierId: TierId;
}

export interface RunState {
  levelId: string;
  difficultyMult: number;
  waypointsPx: Point[];
  basePos: Point;
  baseHealth: number;
  baseMaxHealth: number;
  phase: RunPhase;
  /** 1-based; 0 before the first wave. */
  waveIndex: number;
  highestWaveThisRun: number;
  enemies: Enemy[];
  spawnQueue: QueuedEnemy[];
  spawnTimerMs: number;
  intermissionTimerMs: number;
  nextEnemyId: number;
  /** Death events for the renderer to consume (base contact / future kills). */
  deathFx: DeathFx[];
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
    basePos: waypointsPx[waypointsPx.length - 1]!,
    baseHealth: maxHealth,
    baseMaxHealth: maxHealth,
    phase: 'intermission',
    waveIndex: 0,
    highestWaveThisRun: 0,
    enemies: [],
    spawnQueue: [],
    spawnTimerMs: 0,
    intermissionTimerMs: WAVE_INTERMISSION_MS,
    nextEnemyId: 1,
    deathFx: [],
  };
}

function waveTier(wave: number): TierId {
  return VISIBLE_TIERS[(wave - 1) % VISIBLE_TIERS.length]!.id;
}

/** Build the spawn queue for the next wave and enter the spawning phase. */
export function startNextWave(run: RunState): void {
  const w = run.waveIndex + 1;
  run.waveIndex = w;

  const count = Math.ceil(
    WAVE_BASE_ENEMY_COUNT * Math.pow(WAVE_COUNT_GROWTH, w - 1) * run.difficultyMult,
  );
  const hp = ENEMY_BASE_HP * Math.pow(WAVE_HP_GROWTH, w - 1) * run.difficultyMult;
  const speed = ENEMY_BASE_SPEED * Math.pow(WAVE_SPEED_GROWTH, w - 1);
  const tierId = waveTier(w);

  run.spawnQueue = [];
  for (let i = 0; i < count; i++) {
    run.spawnQueue.push({ hp, speed, tierId });
  }
  run.spawnTimerMs = 0;
  run.phase = 'spawning';
}

/** Advance the run by `dtMs`. Returns `defeated: true` on the frame the base falls. */
export function tickRun(run: RunState, dtMs: number): { defeated: boolean } {
  if (run.phase === 'defeat') return { defeated: false };

  const dtSec = dtMs / 1000;

  if (run.phase === 'intermission') {
    run.intermissionTimerMs -= dtMs;
    if (run.intermissionTimerMs <= 0) {
      startNextWave(run);
    }
  }

  if (run.phase === 'spawning') {
    run.spawnTimerMs -= dtMs;
    while (run.spawnTimerMs <= 0 && run.spawnQueue.length > 0) {
      const q = run.spawnQueue.shift()!;
      run.enemies.push(
        spawnEnemy(run.nextEnemyId++, run.waypointsPx, q.hp, q.speed, q.tierId),
      );
      run.spawnTimerMs += WAVE_SPAWN_INTERVAL_MS;
    }
    if (run.spawnQueue.length === 0) {
      run.phase = 'wave-active';
    }
  }

  // Move enemies; handle base contact.
  for (const e of run.enemies) {
    if (e.dead) continue;
    const { reachedBase } = advanceEnemy(e, run.waypointsPx, dtSec);
    if (reachedBase) {
      e.dead = true;
      run.baseHealth -= ENEMY_BASE_DAMAGE;
      run.deathFx.push({ x: run.basePos.x, y: run.basePos.y, tierId: e.tierId });
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

  // Wave cleared?
  if (
    run.phase === 'wave-active' &&
    run.enemies.length === 0 &&
    run.spawnQueue.length === 0
  ) {
    run.highestWaveThisRun = Math.max(run.highestWaveThisRun, run.waveIndex);
    run.phase = 'intermission';
    run.intermissionTimerMs = WAVE_INTERMISSION_MS;
  }

  return { defeated: false };
}

/** Enemies still alive or queued for the current wave. */
export function enemiesRemaining(run: RunState): number {
  return run.enemies.length + run.spawnQueue.length;
}
