/**
 * Level definitions — the single source of truth for RasterTD's stages.
 * Each level owns an enemy path (a polyline of normalized 0..1 points in the
 * field, last point = the base), difficulty/reward multipliers, and where its
 * node sits on the level map.
 */

export type LevelId =
  | 'level-1'
  | 'level-2'
  | 'level-3'
  | 'level-4'
  | 'level-5';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface LevelDefinition {
  readonly id: LevelId;
  readonly displayName: string;
  /** Enemy path, normalized 0..1 in field space. Last point is the base. */
  readonly waypoints: readonly Point[];
  /** Base hit points before prestige bonuses. */
  readonly baseHealth: number;
  /** Scales enemy count / hp / (indirectly) threat. */
  readonly difficultyMult: number;
  /** Scales the cumulative prestige payout curve for this level. */
  readonly rewardMult: number;
  /** Node position on the level map, normalized 0..1. */
  readonly mapNode: Point;
  /**
   * Highest wave that must be reached on the PREVIOUS level for this one to
   * unlock. `level-1` uses 0 (always unlocked).
   */
  readonly unlockAtWave: number;
}

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 'level-1',
    displayName: 'Foothold',
    waypoints: [
      { x: 0.05, y: 0.20 },
      { x: 0.55, y: 0.20 },
      { x: 0.55, y: 0.65 },
      { x: 0.90, y: 0.65 },
    ],
    baseHealth: 20,
    difficultyMult: 1.0,
    rewardMult: 1.0,
    mapNode: { x: 0.20, y: 0.78 },
    unlockAtWave: 0,
  },
  {
    id: 'level-2',
    displayName: 'Switchback',
    waypoints: [
      { x: 0.05, y: 0.15 },
      { x: 0.80, y: 0.15 },
      { x: 0.80, y: 0.45 },
      { x: 0.20, y: 0.45 },
      { x: 0.20, y: 0.80 },
      { x: 0.90, y: 0.80 },
    ],
    baseHealth: 22,
    difficultyMult: 1.35,
    rewardMult: 1.6,
    mapNode: { x: 0.38, y: 0.60 },
    unlockAtWave: 5,
  },
  {
    id: 'level-3',
    displayName: 'The Spiral',
    waypoints: [
      { x: 0.05, y: 0.50 },
      { x: 0.45, y: 0.50 },
      { x: 0.45, y: 0.15 },
      { x: 0.85, y: 0.15 },
      { x: 0.85, y: 0.85 },
      { x: 0.30, y: 0.85 },
      { x: 0.30, y: 0.65 },
    ],
    baseHealth: 24,
    difficultyMult: 1.8,
    rewardMult: 2.6,
    mapNode: { x: 0.56, y: 0.44 },
    unlockAtWave: 8,
  },
  {
    id: 'level-4',
    displayName: 'Crossfire',
    waypoints: [
      { x: 0.05, y: 0.30 },
      { x: 0.50, y: 0.30 },
      { x: 0.50, y: 0.70 },
      { x: 0.15, y: 0.70 },
      { x: 0.15, y: 0.50 },
      { x: 0.95, y: 0.50 },
    ],
    baseHealth: 26,
    difficultyMult: 2.4,
    rewardMult: 4.2,
    mapNode: { x: 0.72, y: 0.30 },
    unlockAtWave: 10,
  },
  {
    id: 'level-5',
    displayName: 'Last Line',
    waypoints: [
      { x: 0.05, y: 0.10 },
      { x: 0.90, y: 0.10 },
      { x: 0.90, y: 0.35 },
      { x: 0.10, y: 0.35 },
      { x: 0.10, y: 0.60 },
      { x: 0.90, y: 0.60 },
      { x: 0.90, y: 0.85 },
      { x: 0.50, y: 0.85 },
    ],
    baseHealth: 30,
    difficultyMult: 3.2,
    rewardMult: 6.8,
    mapNode: { x: 0.86, y: 0.16 },
    unlockAtWave: 12,
  },
] as const;

export const LEVEL_BY_ID: ReadonlyMap<LevelId, LevelDefinition> = new Map(
  LEVELS.map((l) => [l.id, l]),
);

/** The level immediately before `id` in progression order, or null for the first. */
export function previousLevel(id: LevelId): LevelDefinition | null {
  const idx = LEVELS.findIndex((l) => l.id === id);
  return idx > 0 ? LEVELS[idx - 1]! : null;
}
