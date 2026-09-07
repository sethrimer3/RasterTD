/**
 * Tower simulation. Towers apply forces to enemies (never damage). Continuous
 * towers (fan, singularity) add to each enemy's force accumulator; cooldown
 * towers (zap, blaster) apply an impulse straight to velocity when they fire.
 * A force "hit" is absorbed by a shield instead of moving the enemy.
 */

import type { TowerTypeId } from '../../data/towers';
import { TOWER_DEF_BY_ID } from '../../data/towers';
import {
  TOWER_PATH_CLEARANCE_PX,
  TOWER_MIN_SPACING_PX,
} from '../../data/balance';
import type { Enemy, PathGeometry } from '../enemies';
import { distanceToPath } from '../enemies';

export interface Tower {
  id: number;
  typeId: TowerTypeId;
  x: number;
  y: number;
  orientationRad: number;
  cooldownLeftMs: number;
}

export interface TowerMods {
  damageMult: number;
  rangeMult: number;
  fireRateMult: number;
}

export const NO_MODS: TowerMods = { damageMult: 1, rangeMult: 1, fireRateMult: 1 };

export interface TowerFx {
  kind: 'blast' | 'zap';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius?: number;
  bornMs: number;
}

export function createTower(
  id: number,
  typeId: TowerTypeId,
  x: number,
  y: number,
  orientationRad: number,
): Tower {
  return { id, typeId, x, y, orientationRad, cooldownLeftMs: 0 };
}

export function canPlaceTower(
  towers: readonly Tower[],
  geo: PathGeometry,
  x: number,
  y: number,
  fieldW: number,
  fieldH: number,
): boolean {
  if (x < 4 || y < 4 || x > fieldW - 4 || y > fieldH - 4) return false;
  if (distanceToPath(geo, x, y).dist <= TOWER_PATH_CLEARANCE_PX) return false;
  for (const t of towers) {
    if (Math.hypot(t.x - x, t.y - y) < TOWER_MIN_SPACING_PX) return false;
  }
  return true;
}

/** A shielded (not frozen) enemy absorbs a discrete force hit; returns true if absorbed. */
function absorbHit(e: Enemy): boolean {
  if (e.shieldHits > 0) {
    e.shieldHits -= 1;
    return true;
  }
  return e.auraShielded;
}

export function applyTowerForces(
  towers: readonly Tower[],
  enemies: readonly Enemy[],
  geo: PathGeometry,
  dtMs: number,
  mods: TowerMods,
  nowMs: number,
  fxOut: TowerFx[],
): void {
  for (const tower of towers) {
    const def = TOWER_DEF_BY_ID.get(tower.typeId);
    if (!def) continue;
    const range = def.range * mods.rangeMult;
    const kind = def.kind;

    if (kind.type === 'fan') {
      const fxDir = Math.cos(tower.orientationRad);
      const fyDir = Math.sin(tower.orientationRad);
      for (const e of enemies) {
        if (e.frozenMs > 0 || e.shieldHits > 0 || e.auraShielded) continue;
        const dx = e.x - tower.x;
        const dy = e.y - tower.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range || dist < 1) continue;
        const cosAng = (dx * fxDir + dy * fyDir) / dist;
        if (cosAng < Math.cos(kind.coneHalfAngleRad)) continue;
        // Gentle falloff so the push still bites near the edge of range.
        const falloff = 1 - 0.55 * (dist / range);
        const force = kind.pushAccel * falloff * mods.damageMult;
        e.fx += fxDir * force;
        e.fy += fyDir * force;
      }
      continue;
    }

    if (kind.type === 'singularity') {
      for (const e of enemies) {
        if (e.frozenMs > 0 || e.shieldHits > 0 || e.auraShielded) continue;
        const dx = tower.x - e.x;
        const dy = tower.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range || dist < 1) continue;
        const falloff = 1 - dist / range;
        const force = kind.pullAccel * falloff * mods.damageMult;
        e.fx += (dx / dist) * force;
        e.fy += (dy / dist) * force;
      }
      continue;
    }

    if (kind.type === 'cryo') {
      for (const e of enemies) {
        if (e.frozenMs > 0) continue;
        if (Math.hypot(e.x - tower.x, e.y - tower.y) > range) continue;
        e.chilledMs = Math.max(e.chilledMs, kind.chillMs);
      }
      continue;
    }

    // Cooldown towers: zap, blaster.
    tower.cooldownLeftMs -= dtMs;
    if (tower.cooldownLeftMs > 0) continue;

    if (kind.type === 'blaster') {
      let fired = false;
      for (const e of enemies) {
        if (e.frozenMs > 0) continue;
        const dx = e.x - tower.x;
        const dy = e.y - tower.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range || dist < 1) continue;
        fired = true;
        if (absorbHit(e)) continue;
        const falloff = 1 - dist / range;
        const j = (kind.impulse * falloff * mods.damageMult) / e.mass;
        e.vx += (dx / dist) * j;
        e.vy += (dy / dist) * j;
      }
      if (fired) {
        fxOut.push({ kind: 'blast', x: tower.x, y: tower.y, radius: range, bornMs: nowMs });
        tower.cooldownLeftMs = kind.cooldownMs / mods.fireRateMult;
      }
      continue;
    }

    if (kind.type === 'zap') {
      let target: Enemy | null = null;
      for (const e of enemies) {
        if (e.frozenMs > 0) continue;
        if (Math.hypot(e.x - tower.x, e.y - tower.y) > range) continue;
        if (!target || e.pathDist > target.pathDist) target = e;
      }
      if (target) {
        const near = distanceToPath(geo, target.x, target.y);
        let nx = -near.tangentY;
        let ny = near.tangentX;
        // Push toward whichever side of the path the enemy is already on.
        const side = (target.x - tower.x) * nx + (target.y - tower.y) * ny;
        if (side < 0) {
          nx = -nx;
          ny = -ny;
        }
        if (!absorbHit(target)) {
          const j = (kind.impulse * mods.damageMult) / target.mass;
          target.vx += nx * j;
          target.vy += ny * j;
        }
        fxOut.push({
          kind: 'zap',
          x: tower.x,
          y: tower.y,
          x2: target.x,
          y2: target.y,
          bornMs: nowMs,
        });
        tower.cooldownLeftMs = kind.cooldownMs / mods.fireRateMult;
      }
      continue;
    }
  }
}
