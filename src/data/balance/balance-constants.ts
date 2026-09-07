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
/** Per-wave growth of enemy mass (they get heavier / harder to shove). */
export const WAVE_MASS_GROWTH = 1.05;
/** Per-wave growth of enemy path speed. */
export const WAVE_SPEED_GROWTH = 1.03;
/** Delay between individual enemy spawns while a wave spawns (ms). */
export const WAVE_SPAWN_INTERVAL_MS = 560;
/** Breather between clearing a wave and the next one auto-starting (ms). */
export const WAVE_INTERMISSION_MS = 6000;
/** A brute enemy spawns on every wave that is a multiple of this. */
export const BRUTE_WAVE_INTERVAL = 5;

/** Base target speed along the path in field px/sec (wave 1, before scaling). */
export const ENEMY_BASE_SPEED = 24;
/** Fallback enemy draw radius in field px (kinds override this). */
export const ENEMY_RADIUS = 4;
/** Damage dealt to the base when an enemy reaches it. */
export const ENEMY_BASE_DAMAGE = 1;

// ─── Force physics ─────────────────────────────────────────────
// Enemies are point masses. A steering force keeps them on the path; tower
// forces fight it. Pushed far enough off the polyline, an enemy dies.

/** Steering acceleration pulling an enemy toward its look-ahead point on the path. */
export const PATH_FOLLOW_ACCEL = 240;
/** How far ahead along the path the steering target sits (field px). */
export const PATH_LOOKAHEAD_PX = 14;
/** Per-second velocity retention (1 = frictionless). Applied as pow(d, dt). */
export const V_DAMPING = 0.02;
/** Velocity retention while chilled — closer to 1, so pushes carry further. */
export const V_DAMPING_CHILLED = 0.30;
/** Steering strength multiplier while chilled (can't fight the wind as well). */
export const CHILL_STEER_MULT = 0.35;
/** Chill lingers this long after leaving a cryo tower's range (ms). */
export const CHILL_LINGER_MS = 900;
/** Perpendicular distance from the path beyond which an enemy is flung off and dies. */
export const KILL_DISTANCE_PX = 26;
/** Hard cap on enemy speed (field px/sec) so a big impulse can't skip the kill zone. */
export const MAX_ENEMY_SPEED = 460;
/** A shielded enemy protects allies within this radius. */
export const SHIELD_AURA_RADIUS_PX = 26;

// ─── Run economy ──────────────────────────────────────────────
/** In-run money the player starts each run with. */
export const STARTING_MONEY = 120;
/** Bonus money for clearing a wave. */
export const WAVE_CLEAR_BONUS = 15;
/** Fraction of a tower's cost refunded on sell. */
export const TOWER_SELL_REFUND = 0.5;
/** Minimum clearance between a tower and the path centerline (field px). */
export const TOWER_PATH_CLEARANCE_PX = 10;
/** Minimum spacing between two towers (field px). */
export const TOWER_MIN_SPACING_PX = 12;

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
