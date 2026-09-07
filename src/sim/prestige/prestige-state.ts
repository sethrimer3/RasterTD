/**
 * Prestige (meta) progression. Currency is earned only by beating your previous
 * highest wave on a level — the award is the difference of the cumulative-reward
 * curve between the new and old highest wave. Currency buys permanent upgrades.
 */

import type { LevelDefinition } from '../../data/levels';
import { previousLevel } from '../../data/levels';
import { cumulativePrestigeReward } from '../../data/balance';
import type { PrestigeEffectKind, PrestigeUpgradeId } from '../../data/prestige';
import {
  PRESTIGE_UPGRADES,
  PRESTIGE_UPGRADE_BY_ID,
  prestigeUpgradeCost,
} from '../../data/prestige';

export interface PrestigeState {
  currency: number;
  highestWaveByLevel: Record<string, number>;
  upgradeLevels: Record<string, number>;
}

export function createPrestigeState(): PrestigeState {
  return { currency: 0, highestWaveByLevel: {}, upgradeLevels: {} };
}

export function getUpgradeLevel(prestige: PrestigeState, id: PrestigeUpgradeId): number {
  return prestige.upgradeLevels[id] ?? 0;
}

/** Summed additive effect across every upgrade of the given kind. */
export function upgradeEffectTotal(
  prestige: PrestigeState,
  kind: PrestigeEffectKind,
): number {
  let total = 0;
  for (const def of PRESTIGE_UPGRADES) {
    if (def.effectKind !== kind) continue;
    total += def.effectPerLevel * getUpgradeLevel(prestige, def.id);
  }
  return total;
}

/** Multiplier applied to prestige currency earned (1 + War Dividend total). */
export function currencyMult(prestige: PrestigeState): number {
  return 1 + upgradeEffectTotal(prestige, 'currency_mult');
}

/** Flat base-health bonus from Reinforced Base. */
export function baseHealthBonus(prestige: PrestigeState): number {
  return upgradeEffectTotal(prestige, 'base_health');
}

/**
 * Record a finished run and award prestige currency for any NEW highest wave on
 * that level. Returns the currency granted (0 if no new record).
 */
export function awardRun(
  prestige: PrestigeState,
  level: LevelDefinition,
  waveReached: number,
): number {
  const prev = prestige.highestWaveByLevel[level.id] ?? 0;
  if (waveReached <= prev) return 0;

  const delta =
    cumulativePrestigeReward(waveReached, level.rewardMult) -
    cumulativePrestigeReward(prev, level.rewardMult);
  const gain = Math.max(0, Math.round(delta * currencyMult(prestige)));

  prestige.currency += gain;
  prestige.highestWaveByLevel[level.id] = waveReached;
  return gain;
}

export function tryBuyPrestigeUpgrade(
  prestige: PrestigeState,
  id: PrestigeUpgradeId,
): boolean {
  const def = PRESTIGE_UPGRADE_BY_ID.get(id);
  if (!def) return false;
  const level = getUpgradeLevel(prestige, id);
  if (level >= def.maxLevel) return false;
  const cost = prestigeUpgradeCost(def, level);
  if (prestige.currency < cost) return false;
  prestige.currency -= cost;
  prestige.upgradeLevels[id] = level + 1;
  return true;
}

export function isLevelUnlocked(
  prestige: PrestigeState,
  level: LevelDefinition,
): boolean {
  if (level.unlockAtWave <= 0) return true;
  const prev = previousLevel(level.id);
  if (!prev) return true;
  return (prestige.highestWaveByLevel[prev.id] ?? 0) >= level.unlockAtWave;
}
