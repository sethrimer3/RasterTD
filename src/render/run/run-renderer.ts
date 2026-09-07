/**
 * Draws an active run: the lane, the base, towers (with orientation / range /
 * cooldown), enemies (kind-coded, no health bars), transient tower FX, and the
 * HUD. Death flashes + particles are emitted by the caller.
 */

import type { CanvasContext } from '../canvas';
import type { RunState, DeathFx } from '../../sim/run';
import { enemiesRemaining } from '../../sim/run';
import type { Tower, TowerMods, TowerFx } from '../../sim/towers';
import type { TowerTypeId } from '../../data/towers';
import { TOWER_DEF_BY_ID } from '../../data/towers';
import type { EnemyKindId } from '../../data/enemies';

const TOWER_COLOR: Record<TowerTypeId, string> = {
  fan: '#74c0fc',
  cryo: '#a8e0ff',
  zap: '#ffe066',
  blaster: '#ff8c3c',
  singularity: '#c8a0e0',
};

const KIND_COLOR: Record<EnemyKindId, string> = {
  grunt: '#ffd764',
  runner: '#f0d870',
  heavy: '#8888cc',
  shielder: '#74c0fc',
  freezer: '#dfe9ff',
  brute: '#ff6b6b',
};

export function drawPath(
  cc: CanvasContext,
  waypointsPx: readonly { x: number; y: number }[],
): void {
  if (waypointsPx.length < 2) return;
  const { ctx } = cc;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(90, 82, 66, 0.55)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(waypointsPx[0]!.x, waypointsPx[0]!.y);
  for (let i = 1; i < waypointsPx.length; i++) ctx.lineTo(waypointsPx[i]!.x, waypointsPx[i]!.y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.stroke();
  ctx.restore();
}

export function drawBase(
  cc: CanvasContext,
  pos: { x: number; y: number },
  health: number,
  maxHealth: number,
): void {
  const { ctx } = cc;
  const size = 14;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.fillStyle = health > 0 ? '#2a2a3e' : '#1a1a1a';
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 2;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  const frac = maxHealth > 0 ? Math.max(0, health / maxHealth) : 0;
  ctx.beginPath();
  ctx.arc(0, 0, size, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.strokeStyle = frac > 0.5 ? '#50b464' : frac > 0.25 ? '#e6c850' : '#dc3232';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawTowerBody(
  ctx: CanvasRenderingContext2D,
  t: Tower,
  mods: TowerMods,
  selected: boolean,
): void {
  const def = TOWER_DEF_BY_ID.get(t.typeId);
  if (!def) return;
  const color = TOWER_COLOR[t.typeId];
  const range = def.range * mods.rangeMult;

  // Range / influence ring.
  if (selected || !def.directional) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, range, 0, Math.PI * 2);
    ctx.strokeStyle = selected ? `${color}` : 'rgba(255,255,255,0.10)';
    ctx.setLineDash(selected ? [] : [2, 4]);
    ctx.globalAlpha = selected ? 0.5 : 1;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Directional cone / facing.
  if (def.directional) {
    const half = def.kind.type === 'fan' ? def.kind.coneHalfAngleRad : 0.28;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.arc(t.x, t.y, range, t.orientationRad - half, t.orientationRad + half);
    ctx.closePath();
    ctx.fillStyle = `${color}22`;
    ctx.fill();
  }

  // Body.
  ctx.beginPath();
  ctx.arc(t.x, t.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = selected ? '#ffffff' : 'rgba(0,0,0,0.6)';
  ctx.stroke();

  // Cooldown arc for zap / blaster.
  if (def.kind.type === 'zap' || def.kind.type === 'blaster') {
    const cd = def.kind.cooldownMs / mods.fireRateMult;
    const frac = 1 - Math.max(0, Math.min(1, t.cooldownLeftMs / cd));
    ctx.beginPath();
    ctx.arc(t.x, t.y, 6.5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function drawTowers(
  cc: CanvasContext,
  towers: readonly Tower[],
  selectedId: number | null,
  mods: TowerMods,
): void {
  const { ctx } = cc;
  ctx.save();
  for (const t of towers) drawTowerBody(ctx, t, mods, t.id === selectedId);
  ctx.restore();
}

export function drawPlacementGhost(
  cc: CanvasContext,
  typeId: TowerTypeId,
  x: number,
  y: number,
  orientationRad: number,
  valid: boolean,
  mods: TowerMods,
): void {
  const def = TOWER_DEF_BY_ID.get(typeId);
  if (!def) return;
  const { ctx } = cc;
  const range = def.range * mods.rangeMult;
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(x, y, range, 0, Math.PI * 2);
  ctx.strokeStyle = valid ? '#50b464' : '#dc3232';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  if (def.directional) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(orientationRad) * range, y + Math.sin(orientationRad) * range);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = valid ? '#50b464' : '#dc3232';
  ctx.fill();
  ctx.restore();
}

export function drawEnemies(cc: CanvasContext, run: RunState): void {
  const { ctx } = cc;
  ctx.save();
  for (const e of run.enemies) {
    const r = e.radius;
    const chilled = e.chilledMs > 0;
    const frozen = e.frozenMs > 0;

    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fillStyle = frozen ? '#bfe8ff' : chilled ? shade(KIND_COLOR[e.kindId]) : KIND_COLOR[e.kindId];
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = frozen ? '#7fd8ff' : 'rgba(0,0,0,0.5)';
    ctx.stroke();

    // Shield ring + pip count.
    if (e.shieldHits > 0 || e.auraShielded) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = e.auraShielded && e.shieldHits <= 0 ? 'rgba(116,192,252,0.5)' : '#74c0fc';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (e.shieldHits > 0) {
        ctx.fillStyle = '#74c0fc';
        ctx.font = '6px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(e.shieldHits), e.x, e.y - r - 4);
      }
    }

    if (frozen) {
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.x - r, e.y);
      ctx.lineTo(e.x + r, e.y);
      ctx.moveTo(e.x, e.y - r);
      ctx.lineTo(e.x, e.y + r);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Blend a #rrggbb colour toward chilled-blue. */
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number, t: number): number => Math.round(c * 0.5 + t * 0.5);
  const rr = mix(r, 0x6d);
  const gg = mix(g, 0xb6);
  const bb = mix(b, 0xff);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

export function drawTowerFx(cc: CanvasContext, fx: TowerFx[], nowMs: number): void {
  const { ctx } = cc;
  ctx.save();
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]!;
    const age = nowMs - f.bornMs;
    if (f.kind === 'blast') {
      const life = 320;
      if (age > life) { fx.splice(i, 1); continue; }
      const t = age / life;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4 + t * ((f.radius ?? 40) - 4), 0, Math.PI * 2);
      ctx.strokeStyle = '#ff8c3c';
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (f.kind === 'zap') {
      const life = 160;
      if (age > life) { fx.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - age / life;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const x1 = f.x, y1 = f.y, x2 = f.x2 ?? f.x, y2 = f.y2 ?? f.y;
      const segs = 5;
      ctx.moveTo(x1, y1);
      for (let s = 1; s < segs; s++) {
        const p = s / segs;
        const jx = (Math.random() - 0.5) * 6;
        const jy = (Math.random() - 0.5) * 6;
        ctx.lineTo(x1 + (x2 - x1) * p + jx, y1 + (y2 - y1) * p + jy);
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawRunHud(cc: CanvasContext, run: RunState): void {
  const { ctx } = cc;
  ctx.save();
  ctx.font = '9px Georgia, serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  ctx.fillStyle = '#e6e6ea';
  ctx.fillText(run.waveIndex === 0 ? 'Wave —' : `Wave ${run.waveIndex}`, 8, 8);
  ctx.fillStyle = '#8a8a9a';
  ctx.fillText(`Enemies ${enemiesRemaining(run)}`, 8, 20);
  ctx.fillText(`Base ${Math.ceil(run.baseHealth)}/${run.baseMaxHealth}`, 8, 32);
  ctx.fillStyle = '#c9a84c';
  ctx.fillText(`¤ ${Math.floor(run.money)}`, 8, 44);

  if (run.phase === 'intermission' && run.intermissionTimerMs > 0) {
    ctx.fillStyle = '#8a8a9a';
    ctx.fillText(`Next wave in ${Math.ceil(run.intermissionTimerMs / 1000)}s`, 8, 56);
  }

  if (run.phase === 'defeat') {
    ctx.textAlign = 'center';
    ctx.font = '16px Georgia, serif';
    ctx.fillStyle = '#dc3232';
    ctx.fillText('BASE DESTROYED', cc.widthPx / 2, cc.heightPx / 2 - 8);
    ctx.font = '10px Georgia, serif';
    ctx.fillStyle = '#8a8a9a';
    ctx.fillText(`Reached wave ${run.highestWaveThisRun}`, cc.widthPx / 2, cc.heightPx / 2 + 12);
  }
  ctx.restore();
}

export type { DeathFx };
