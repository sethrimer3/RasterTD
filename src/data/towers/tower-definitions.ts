/**
 * Tower types. Towers never damage enemies — they apply forces to shove enemies
 * off the path. `directional` towers have a player-set orientation.
 */

export type TowerTypeId = 'fan' | 'cryo' | 'zap' | 'blaster' | 'singularity';

interface FanKind {
  readonly type: 'fan';
  /** Half-angle of the push cone, radians. */
  readonly coneHalfAngleRad: number;
  /** Continuous acceleration along the facing direction (px/s^2), at the tower. */
  readonly pushAccel: number;
}
interface CryoKind {
  readonly type: 'cryo';
  /** Chill duration refreshed on enemies in range (ms). */
  readonly chillMs: number;
}
interface ZapKind {
  readonly type: 'zap';
  readonly cooldownMs: number;
  /** Instantaneous velocity change applied perpendicular to the path (px/s). */
  readonly impulse: number;
}
interface BlasterKind {
  readonly type: 'blaster';
  readonly cooldownMs: number;
  /** Radial velocity change at the tower, falls off with distance (px/s). */
  readonly impulse: number;
}
interface SingularityKind {
  readonly type: 'singularity';
  /** Continuous acceleration toward the tower (px/s^2), falls off with distance. */
  readonly pullAccel: number;
}

export type TowerKindConfig =
  | FanKind
  | CryoKind
  | ZapKind
  | BlasterKind
  | SingularityKind;

export interface TowerDef {
  readonly id: TowerTypeId;
  readonly displayName: string;
  readonly description: string;
  readonly cost: number;
  readonly range: number;
  readonly directional: boolean;
  readonly kind: TowerKindConfig;
}

export const TOWER_DEFS: readonly TowerDef[] = [
  {
    id: 'fan',
    displayName: 'Fan',
    description: 'Steady wind in a cone. Aim it across the track.',
    cost: 40,
    range: 82,
    directional: true,
    kind: { type: 'fan', coneHalfAngleRad: Math.PI / 3, pushAccel: 760 },
  },
  {
    id: 'cryo',
    displayName: 'Cryo',
    description: 'Chills enemies in range so pushes carry them further.',
    cost: 55,
    range: 44,
    directional: false,
    kind: { type: 'cryo', chillMs: 700 },
  },
  {
    id: 'zap',
    displayName: 'Zap',
    description: 'Periodic jolt to the lead enemy, knocking it sideways.',
    cost: 70,
    range: 66,
    directional: true,
    kind: { type: 'zap', cooldownMs: 1300, impulse: 130 },
  },
  {
    id: 'blaster',
    displayName: 'Blaster',
    description: 'Periodic shockwave that scatters a whole cluster.',
    cost: 95,
    range: 50,
    directional: false,
    kind: { type: 'blaster', cooldownMs: 1800, impulse: 150 },
  },
  {
    id: 'singularity',
    displayName: 'Singularity',
    description: 'Pulls everything toward it. Place it just off the track.',
    cost: 130,
    range: 72,
    directional: false,
    kind: { type: 'singularity', pullAccel: 460 },
  },
];

export const TOWER_DEF_BY_ID: ReadonlyMap<TowerTypeId, TowerDef> = new Map(
  TOWER_DEFS.map((t) => [t.id, t]),
);
