/**
 * Draws the level-select map on the game canvas: level nodes joined by a route,
 * locked ones dimmed. `hitTestLevelNode` maps a canvas-space point to a level.
 */

import type { CanvasContext } from '../canvas';
import type { LevelDefinition, LevelId } from '../../data/levels';
import { LEVELS } from '../../data/levels';
import type { PrestigeState } from '../../sim/prestige';
import { isLevelUnlocked } from '../../sim/prestige';

const NODE_RADIUS = 9;
/** Extra forgiveness added to the node radius for pointer hit-testing. */
const HIT_PADDING = 8;

function nodePos(cc: CanvasContext, level: LevelDefinition): { x: number; y: number } {
  return { x: level.mapNode.x * cc.widthPx, y: level.mapNode.y * cc.heightPx };
}

export function drawLevelMap(
  cc: CanvasContext,
  prestige: PrestigeState,
  hoveredId: LevelId | null,
): void {
  const { ctx } = cc;

  // Route between consecutive level nodes.
  ctx.save();
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  LEVELS.forEach((level, i) => {
    const p = nodePos(cc, level);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const level of LEVELS) {
    const p = nodePos(cc, level);
    const unlocked = isLevelUnlocked(prestige, level);
    const best = prestige.highestWaveByLevel[level.id] ?? 0;
    const isHover = hoveredId === level.id;

    ctx.beginPath();
    ctx.arc(p.x, p.y, NODE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = unlocked ? '#1a1a2e' : '#101018';
    ctx.fill();
    ctx.lineWidth = isHover ? 3 : 2;
    ctx.strokeStyle = unlocked
      ? (isHover ? '#ffe599' : '#c9a84c')
      : 'rgba(138, 138, 154, 0.4)';
    ctx.stroke();

    // Node glyph: index number when unlocked, a bar (lock) when not.
    ctx.fillStyle = unlocked ? '#e6e6ea' : 'rgba(138,138,154,0.6)';
    ctx.font = '9px Georgia, serif';
    ctx.fillText(
      unlocked ? String(LEVELS.indexOf(level) + 1) : '–',
      p.x,
      p.y + 0.5,
    );

    // Name below.
    ctx.fillStyle = unlocked ? '#8a8a9a' : 'rgba(138,138,154,0.35)';
    ctx.font = '8px Georgia, serif';
    ctx.fillText(level.displayName, p.x, p.y + NODE_RADIUS + 8);

    // Best wave above (only if any progress).
    if (best > 0) {
      ctx.fillStyle = '#c9a84c';
      ctx.fillText(`best W${best}`, p.x, p.y - NODE_RADIUS - 7);
    }
  }

  // Title.
  ctx.fillStyle = 'rgba(201, 168, 76, 0.9)';
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('SELECT LEVEL', 8, 12);
  ctx.restore();
}

export function hitTestLevelNode(
  cc: CanvasContext,
  x: number,
  y: number,
): LevelId | null {
  const r = NODE_RADIUS + HIT_PADDING;
  for (const level of LEVELS) {
    const p = nodePos(cc, level);
    if (Math.hypot(x - p.x, y - p.y) <= r) return level.id;
  }
  return null;
}
