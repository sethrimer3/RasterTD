/**
 * Enemy kinds. Enemies have no health — they differ by mass (how hard they are
 * to shove off the path), speed, bounty, and special abilities. Bigger / special
 * kinds pay more when flung off track.
 */

export type EnemyKindId =
  | 'grunt'
  | 'runner'
  | 'heavy'
  | 'shielder'
  | 'freezer'
  | 'brute';

export interface EnemyKindDef {
  readonly id: EnemyKindId;
  readonly displayName: string;
  /** Higher = harder to push. */
  readonly mass: number;
  /** Draw radius, field px. */
  readonly radius: number;
  /** Multiplier on the wave's base path speed. */
  readonly speedMult: number;
  /** Money awarded when pushed off the track. */
  readonly bounty: number;
  /** Force hits absorbed before physics affects this enemy (0 = no shield). */
  readonly shieldHits: number;
  /** Whether a shielded enemy of this kind protects nearby allies too. */
  readonly projectsAura: boolean;
  /** If set, the enemy periodically freezes solid (immovable + immune). */
  readonly selfFreeze?: { readonly everyMs: number; readonly durationMs: number };
}

export const ENEMY_KINDS: readonly EnemyKindDef[] = [
  { id: 'grunt',    displayName: 'Grunt',    mass: 1.0, radius: 4,  speedMult: 1.0,  bounty: 3,  shieldHits: 0, projectsAura: false },
  { id: 'runner',   displayName: 'Runner',   mass: 0.6, radius: 3,  speedMult: 1.7,  bounty: 4,  shieldHits: 0, projectsAura: false },
  { id: 'heavy',    displayName: 'Heavy',    mass: 3.2, radius: 6,  speedMult: 0.62, bounty: 8,  shieldHits: 0, projectsAura: false },
  { id: 'shielder', displayName: 'Shielder', mass: 1.6, radius: 5,  speedMult: 0.85, bounty: 12, shieldHits: 3, projectsAura: true },
  { id: 'freezer',  displayName: 'Freezer',  mass: 1.0, radius: 4,  speedMult: 0.9,  bounty: 8,  shieldHits: 0, projectsAura: false, selfFreeze: { everyMs: 4200, durationMs: 1600 } },
  { id: 'brute',    displayName: 'Brute',    mass: 6.5, radius: 9,  speedMult: 0.5,  bounty: 40, shieldHits: 5, projectsAura: false },
];

export const ENEMY_KIND_BY_ID: ReadonlyMap<EnemyKindId, EnemyKindDef> = new Map(
  ENEMY_KINDS.map((k) => [k.id, k]),
);
