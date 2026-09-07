/**
 * Global balance constants — single place to tune game feel.
 * All monetary/progression formulas reference these.
 */

/** Base motes earned per tap at tier level 1. */
export const BASE_TAP_VALUE = 1;

/** Cost of the first equation upgrade for each tier. */
export const BASE_UPGRADE_COST = 10;

/** Cost scaling exponent per level: cost = baseCost * scaleFactor^level */
export const UPGRADE_COST_SCALE_FACTOR = 1.15;

/** Multiplier per equation upgrade level applied to tap value. */
export const UPGRADE_TAP_MULTIPLIER = 1.0;

/** Base interval for auto-tap (ms). Reduced by automation upgrades. */
export const BASE_AUTO_TAP_INTERVAL_MS = 5000;

/** Minimum auto-tap interval (ms), hard floor. */
export const MIN_AUTO_TAP_INTERVAL_MS = 200;

/** Auto-tap interval reduction per automation upgrade level (ms). */
export const AUTO_TAP_INTERVAL_REDUCTION_MS = 400;

/** Max particles on screen at once (performance cap). */
export const MAX_PARTICLE_COUNT = 300;

/** Particle base lifetime (ms). */
export const PARTICLE_LIFETIME_MS = 2000;

/** Particles emitted per tap. */
export const PARTICLES_PER_TAP = 5;

/** Save interval (ms). */
export const AUTO_SAVE_INTERVAL_MS = 30_000;

/** Offline progress cap (hours). */
export const MAX_OFFLINE_HOURS = 24;

/** Number of tiers unlocked at game start. */
export const INITIAL_UNLOCKED_TIER_COUNT = 1;

/** Cost in Sand motes to unlock the Equation Forge. */
export const EQUATION_FORGE_COST = 50;

/** Mote threshold to unlock the next tier — tierIndex is 0-based for the tier being unlocked. */
export function tierUnlockCost(tierIndex: number): number {
  return Math.floor(50 * Math.pow(10, tierIndex));
}

// ─── Tower-defense tunables ─────────────────────────────────────
// Waves grow exponentially in threat and in prestige payout.

/** Enemies in wave 1 (before per-level difficulty scaling). */
export const WAVE_BASE_ENEMY_COUNT = 6;
/** Per-wave growth of enemy count. */
export const WAVE_COUNT_GROWTH = 1.15;
/** Per-wave growth of enemy hit points. */
export const WAVE_HP_GROWTH = 1.35;
/** Per-wave growth of enemy speed. */
export const WAVE_SPEED_GROWTH = 1.03;
/** Delay between individual enemy spawns while a wave spawns (ms). */
export const WAVE_SPAWN_INTERVAL_MS = 550;
/** Breather between clearing a wave and the next one auto-starting (ms). */
export const WAVE_INTERMISSION_MS = 6000;

/** Enemy hit points in wave 1 (before scaling). */
export const ENEMY_BASE_HP = 10;
/** Enemy travel speed along the path in field px/sec (wave 1, before scaling). */
export const ENEMY_BASE_SPEED = 26;
/** Enemy draw radius in field px. */
export const ENEMY_RADIUS = 4;
/** Damage dealt to the base when an enemy reaches it. */
export const ENEMY_BASE_DAMAGE = 1;

/** Prestige payout curve: cumReward(w) = floor(SCALE * rewardMult * (G^w - 1) / (G - 1)). */
export const PRESTIGE_REWARD_GROWTH = 1.32;
export const PRESTIGE_REWARD_SCALE = 0.95;

/**
 * Cumulative prestige currency for reaching wave `wave` on a level with the given
 * reward multiplier. A run awards the difference between this at the new highest
 * wave and this at the previous highest wave.
 */
export function cumulativePrestigeReward(wave: number, rewardMult: number): number {
  if (wave <= 0) return 0;
  const g = PRESTIGE_REWARD_GROWTH;
  return Math.floor(PRESTIGE_REWARD_SCALE * rewardMult * (Math.pow(g, wave) - 1) / (g - 1));
}
