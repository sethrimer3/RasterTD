/**
 * Enemy simulation — force-based. Enemies are 2D point masses. A steering force
 * keeps them advancing along the path; tower forces (accumulated into fx/fy)
 * fight it. Shoved far enough off the polyline, an enemy dies. Enemies have no
 * health and are never removed by "damage".
 */

import type { EnemyKindId } from '../../data/enemies';
import { ENEMY_KIND_BY_ID } from '../../data/enemies';
import {
  PATH_FOLLOW_ACCEL,
  PATH_LOOKAHEAD_PX,
  V_DAMPING,
  V_DAMPING_CHILLED,
  CHILL_STEER_MULT,
  KILL_DISTANCE_PX,
  MAX_ENEMY_SPEED,
  SHIELD_AURA_RADIUS_PX,
} from '../../data/balance';
import type { PathGeometry } from './path-geometry';
import { distanceToPath, pointAtArcLength } from './path-geometry';

export interface Enemy {
  id: number;
  kindId: EnemyKindId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  bounty: number;
  /** Target path speed, field px/sec. */
  speed: number;
  /** Arc length travelled along the path. */
  pathDist: number;
  /** External force accumulator, reset every step. */
  fx: number;
  fy: number;
  chilledMs: number;
  frozenMs: number;
  /** Countdown to the next self-freeze (freezer kind only). */
  freezeCooldownMs: number;
  /** Force hits left to absorb before physics affects this enemy. */
  shieldHits: number;
  projectsAura: boolean;
  /** Transient: within a shielded ally's aura this frame. */
  auraShielded: boolean;
  offTrack: boolean;
  dead: boolean;
}

export function spawnEnemy(
  id: number,
  kindId: EnemyKindId,
  geo: PathGeometry,
  baseSpeed: number,
  massScale: number,
): Enemy {
  const def = ENEMY_KIND_BY_ID.get(kindId)!;
  const start = geo.points[0]!;
  return {
    id,
    kindId,
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    mass: def.mass * massScale,
    radius: def.radius,
    bounty: def.bounty,
    speed: baseSpeed * def.speedMult,
    pathDist: 0,
    fx: 0,
    fy: 0,
    chilledMs: 0,
    frozenMs: 0,
    freezeCooldownMs: def.selfFreeze?.everyMs ?? 0,
    shieldHits: def.shieldHits,
    projectsAura: def.projectsAura,
    auraShielded: false,
    offTrack: false,
    dead: false,
  };
}

/** True when this enemy currently ignores external forces. */
export function isEnemyProtected(e: Enemy): boolean {
  return e.frozenMs > 0 || e.shieldHits > 0 || e.auraShielded;
}

/**
 * Advance one enemy by `dtMs`. External forces must already be in `fx/fy`.
 * Returns terminal conditions for the caller to act on. Resets `fx/fy`.
 */
export function stepEnemy(
  e: Enemy,
  geo: PathGeometry,
  dtMs: number,
): { offTrack: boolean; reachedBase: boolean } {
  const dt = dtMs / 1000;

  if (e.chilledMs > 0) e.chilledMs = Math.max(0, e.chilledMs - dtMs);

  if (e.frozenMs > 0) {
    e.frozenMs = Math.max(0, e.frozenMs - dtMs);
    e.vx = 0;
    e.vy = 0;
    e.fx = 0;
    e.fy = 0;
    return { offTrack: false, reachedBase: false };
  }

  const chilled = e.chilledMs > 0;

  // Steering toward the look-ahead point on the path.
  const target = pointAtArcLength(geo, e.pathDist + PATH_LOOKAHEAD_PX);
  let sx = target.x - e.x;
  let sy = target.y - e.y;
  const sLen = Math.hypot(sx, sy) || 1;
  sx /= sLen;
  sy /= sLen;
  const steerMag = PATH_FOLLOW_ACCEL * (chilled ? CHILL_STEER_MULT : 1);

  // Acceleration = steering + external force / mass. Forces are ignored while protected.
  const protectedNow = isEnemyProtected(e);
  const ax = sx * steerMag + (protectedNow ? 0 : e.fx / e.mass);
  const ay = sy * steerMag + (protectedNow ? 0 : e.fy / e.mass);

  e.vx += ax * dt;
  e.vy += ay * dt;

  // Clamp target-speed component along steering so enemies cruise, not accelerate forever.
  const along = e.vx * sx + e.vy * sy;
  if (along > e.speed) {
    e.vx -= (along - e.speed) * sx;
    e.vy -= (along - e.speed) * sy;
  }

  // Damping.
  const damp = Math.pow(chilled ? V_DAMPING_CHILLED : V_DAMPING, dt);
  e.vx *= damp;
  e.vy *= damp;

  // Speed cap.
  const spd = Math.hypot(e.vx, e.vy);
  if (spd > MAX_ENEMY_SPEED) {
    e.vx = (e.vx / spd) * MAX_ENEMY_SPEED;
    e.vy = (e.vy / spd) * MAX_ENEMY_SPEED;
  }

  const dx = e.vx * dt;
  const dy = e.vy * dt;
  e.x += dx;
  e.y += dy;

  const near = distanceToPath(geo, e.x, e.y);
  // Progress advances by forward projection only (shoved back = stalled, not reversed).
  e.pathDist += Math.max(0, dx * near.tangentX + dy * near.tangentY);

  e.fx = 0;
  e.fy = 0;

  if (near.dist > KILL_DISTANCE_PX) {
    e.offTrack = true;
    return { offTrack: true, reachedBase: false };
  }
  if (e.pathDist >= geo.totalLen) {
    return { offTrack: false, reachedBase: true };
  }
  return { offTrack: false, reachedBase: false };
}

/** Flag enemies sitting inside an aura-projecting shielded ally's radius. */
export function applyShieldAura(enemies: readonly Enemy[]): void {
  for (const e of enemies) e.auraShielded = false;
  for (const src of enemies) {
    if (src.shieldHits <= 0 || !src.projectsAura) continue;
    for (const e of enemies) {
      if (e === src) continue;
      if (Math.hypot(e.x - src.x, e.y - src.y) <= SHIELD_AURA_RADIUS_PX) {
        e.auraShielded = true;
      }
    }
  }
}
