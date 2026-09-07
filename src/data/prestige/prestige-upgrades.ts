/**
 * Permanent tower upgrades bought with prestige currency. Levels persist across
 * runs. `tower_*` effects are consumed by the (future) combat pass; `base_health`
 * and `currency_mult` take effect immediately.
 */

export type PrestigeEffectKind =
  | 'tower_damage'
  | 'tower_range'
  | 'tower_fire_rate'
  | 'base_health'
  | 'currency_mult';

export type PrestigeUpgradeId =
  | 'dmg'
  | 'range'
  | 'fire-rate'
  | 'fortify'
  | 'dividend';

export interface PrestigeUpgradeDef {
  readonly id: PrestigeUpgradeId;
  readonly displayName: string;
  readonly description: string;
  readonly maxLevel: number;
  readonly baseCost: number;
  readonly costGrowth: number;
  /** Additive contribution per level toward the effect total. */
  readonly effectPerLevel: number;
  readonly effectKind: PrestigeEffectKind;
}

export const PRESTIGE_UPGRADES: readonly PrestigeUpgradeDef[] = [
  {
    id: 'dmg',
    displayName: 'Sharpened Rounds',
    description: '+15% tower damage per level',
    maxLevel: 20,
    baseCost: 20,
    costGrowth: 1.35,
    effectPerLevel: 0.15,
    effectKind: 'tower_damage',
  },
  {
    id: 'range',
    displayName: 'Extended Optics',
    description: '+10% tower range per level',
    maxLevel: 15,
    baseCost: 25,
    costGrowth: 1.4,
    effectPerLevel: 0.1,
    effectKind: 'tower_range',
  },
  {
    id: 'fire-rate',
    displayName: 'Auto-Loader',
    description: '+12% tower fire rate per level',
    maxLevel: 15,
    baseCost: 30,
    costGrowth: 1.4,
    effectPerLevel: 0.12,
    effectKind: 'tower_fire_rate',
  },
  {
    id: 'fortify',
    displayName: 'Reinforced Base',
    description: '+3 base health per level',
    maxLevel: 25,
    baseCost: 15,
    costGrowth: 1.3,
    effectPerLevel: 3,
    effectKind: 'base_health',
  },
  {
    id: 'dividend',
    displayName: 'War Dividend',
    description: '+5% prestige currency earned per level',
    maxLevel: 20,
    baseCost: 40,
    costGrowth: 1.5,
    effectPerLevel: 0.05,
    effectKind: 'currency_mult',
  },
];

export const PRESTIGE_UPGRADE_BY_ID: ReadonlyMap<PrestigeUpgradeId, PrestigeUpgradeDef> =
  new Map(PRESTIGE_UPGRADES.map((u) => [u.id, u]));

/** Cost to buy the next level of an upgrade given its current level (0-based). */
export function prestigeUpgradeCost(def: PrestigeUpgradeDef, currentLevel: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}
