/**
 * Draws an active run: the enemy lane, the base with its health, the enemies,
 * and a small HUD. Death flashes/particles are handled by the caller via the
 * particle system; this module only draws persistent run state.
 */

import type { CanvasContext } from '../canvas';
import { TIER_BY_ID } from '../../data/tiers';
import { ENEMY_RADIUS } from '../../data/balance';
import type { RunState } from '../../sim/run';
import { enemiesRemaining } from '../../sim/run';

export function drawPath(cc: CanvasContext, waypointsPx: readonly { x: number; y: number }[]): void {
  if (waypointsPx.length < 2) return;
  const { ctx } = cc;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Lane bed.
  ctx.strokeStyle = 'rgba(90, 82, 66, 0.55)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(waypointsPx[0]!.x, waypointsPx[0]!.y);
  for (let i = 1; i < waypointsPx.length; i++) ctx.lineTo(waypointsPx[i]!.x, waypointsPx[i]!.y);
  ctx.stroke();

  // Centre line.
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

  // Health ring.
  const frac = maxHealth > 0 ? Math.max(0, health / maxHealth) : 0;
  ctx.beginPath();
  ctx.arc(0, 0, size, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.strokeStyle = frac > 0.5 ? '#50b464' : frac > 0.25 ? '#e6c850' : '#dc3232';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawEnemies(cc: CanvasContext, run: RunState): void {
  const { ctx } = cc;
  ctx.save();
  for (const e of run.enemies) {
    const tier = TIER_BY_ID.get(e.tierId);
    ctx.beginPath();
    ctx.arc(e.x, e.y, ENEMY_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = tier?.color ?? '#dc3232';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();

    // HP pip.
    const frac = Math.max(0, e.hp / e.maxHp);
    if (frac < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - ENEMY_RADIUS, e.y - ENEMY_RADIUS - 3, ENEMY_RADIUS * 2, 2);
      ctx.fillStyle = '#50b464';
      ctx.fillRect(e.x - ENEMY_RADIUS, e.y - ENEMY_RADIUS - 3, ENEMY_RADIUS * 2 * frac, 2);
    }
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

  const waveLabel = run.waveIndex === 0 ? 'Wave —' : `Wave ${run.waveIndex}`;
  ctx.fillText(waveLabel, 8, 8);
  ctx.fillStyle = '#8a8a9a';
  ctx.fillText(`Enemies ${enemiesRemaining(run)}`, 8, 20);
  ctx.fillText(`Base ${Math.ceil(run.baseHealth)}/${run.baseMaxHealth}`, 8, 32);

  if (run.phase === 'intermission' && run.intermissionTimerMs > 0) {
    ctx.fillStyle = '#c9a84c';
    ctx.fillText(
      `Next wave in ${Math.ceil(run.intermissionTimerMs / 1000)}s`,
      8,
      44,
    );
  }

  if (run.phase === 'defeat') {
    ctx.textAlign = 'center';
    ctx.font = '16px Georgia, serif';
    ctx.fillStyle = '#dc3232';
    ctx.fillText('BASE DESTROYED', cc.widthPx / 2, cc.heightPx / 2 - 8);
    ctx.font = '10px Georgia, serif';
    ctx.fillStyle = '#8a8a9a';
    ctx.fillText(
      `Reached wave ${run.highestWaveThisRun}`,
      cc.widthPx / 2,
      cc.heightPx / 2 + 12,
    );
  }
  ctx.restore();
}
