/**
 * Enemy simulation. Enemies follow the level's waypoint polyline at a fixed
 * speed. Damage/knockback from towers will hook in during the combat pass; the
 * shape here (mutable position + segment progress) leaves room for that.
 */

import type { TierId } from '../../data/tiers';
import type { Point } from '../../data/levels';

export interface Enemy {
  id: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** Index of the path segment the enemy is currently traversing. */
  segmentIndex: number;
  /** Progress 0..1 along the current segment. */
  segmentT: number;
  /** Field px per second. */
  speed: number;
  tierId: TierId;
  dead: boolean;
}

export function spawnEnemy(
  id: number,
  waypointsPx: readonly Point[],
  hp: number,
  speed: number,
  tierId: TierId,
): Enemy {
  const start = waypointsPx[0]!;
  return {
    id,
    hp,
    maxHp: hp,
    x: start.x,
    y: start.y,
    segmentIndex: 0,
    segmentT: 0,
    speed,
    tierId,
    dead: false,
  };
}

/**
 * Advance an enemy along the polyline by `dtSec`. Mutates the enemy in place.
 * Returns `reachedBase: true` once it passes the final waypoint.
 */
export function advanceEnemy(
  e: Enemy,
  waypointsPx: readonly Point[],
  dtSec: number,
): { reachedBase: boolean } {
  let remaining = e.speed * dtSec;
  const lastSegment = waypointsPx.length - 2;

  while (remaining > 0) {
    if (e.segmentIndex > lastSegment) {
      return { reachedBase: true };
    }
    const a = waypointsPx[e.segmentIndex]!;
    const b = waypointsPx[e.segmentIndex + 1]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const distLeftOnSeg = (1 - e.segmentT) * segLen;

    if (remaining < distLeftOnSeg) {
      e.segmentT += remaining / segLen;
      remaining = 0;
    } else {
      remaining -= distLeftOnSeg;
      e.segmentIndex += 1;
      e.segmentT = 0;
    }
  }

  if (e.segmentIndex > lastSegment) {
    return { reachedBase: true };
  }

  const a = waypointsPx[e.segmentIndex]!;
  const b = waypointsPx[e.segmentIndex + 1]!;
  e.x = a.x + (b.x - a.x) * e.segmentT;
  e.y = a.y + (b.y - a.y) * e.segmentT;
  return { reachedBase: false };
}
