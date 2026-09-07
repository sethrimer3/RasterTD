/**
 * Precomputed geometry for an enemy path polyline: per-segment lengths and
 * cumulative arc length, plus nearest-point / arc-length lookups used by the
 * force-physics enemy stepper.
 */

import type { Point } from '../../data/levels';

export interface PathGeometry {
  points: Point[];
  /** segLen[i] = length of segment points[i] -> points[i+1]. */
  segLen: number[];
  /** cumLen[i] = arc length from points[0] to points[i]. cumLen[last] = totalLen. */
  cumLen: number[];
  totalLen: number;
}

export function buildPathGeometry(points: readonly Point[]): PathGeometry {
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const segLen: number[] = [];
  const cumLen: number[] = [0];
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    segLen.push(len);
    cumLen.push(cumLen[i]! + len);
  }
  return { points: pts, segLen, cumLen, totalLen: cumLen[cumLen.length - 1] ?? 0 };
}

/** Point on the path at arc length `s` (clamped to [0, totalLen]). */
export function pointAtArcLength(geo: PathGeometry, s: number): Point {
  const clamped = Math.max(0, Math.min(s, geo.totalLen));
  for (let i = 0; i < geo.segLen.length; i++) {
    const segStart = geo.cumLen[i]!;
    const segEnd = geo.cumLen[i + 1]!;
    if (clamped <= segEnd || i === geo.segLen.length - 1) {
      const a = geo.points[i]!;
      const b = geo.points[i + 1]!;
      const t = geo.segLen[i]! > 0 ? (clamped - segStart) / geo.segLen[i]! : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return { ...geo.points[geo.points.length - 1]! };
}

export interface NearestPathResult {
  /** Perpendicular distance from (x,y) to the polyline. */
  dist: number;
  /** Unit tangent of the closest segment (direction of travel). */
  tangentX: number;
  tangentY: number;
  /** Arc length of the closest point along the path. */
  arcPos: number;
}

/** Closest point on the polyline to (x, y), scanning every segment. */
export function distanceToPath(geo: PathGeometry, x: number, y: number): NearestPathResult {
  let best: NearestPathResult = { dist: Infinity, tangentX: 1, tangentY: 0, arcPos: 0 };
  for (let i = 0; i < geo.segLen.length; i++) {
    const a = geo.points[i]!;
    const b = geo.points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = geo.segLen[i]!;
    if (len <= 0) continue;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / (len * len);
    t = Math.max(0, Math.min(1, t));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best.dist) {
      best = {
        dist: d,
        tangentX: dx / len,
        tangentY: dy / len,
        arcPos: geo.cumLen[i]! + len * t,
      };
    }
  }
  return best;
}
