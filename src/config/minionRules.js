export const MINION_KIND = Object.freeze({ MELEE: 'melee', CASTER: 'caster', CANNON: 'cannon', SUPER: 'super' });

// Health and damage share one made-up unit. Ranges are in map units along the lane; formationBack
// is how far behind the front line a minion stands when it reaches an enemy structure.
export const MINION_STATS = Object.freeze({
  [MINION_KIND.MELEE]: { health: 100, damagePerSecond: 5.5, range: 12, formationBack: 0, towerShotsToKill: 3 },
  [MINION_KIND.CASTER]: { health: 60, damagePerSecond: 7, range: 30, formationBack: 16, towerShotsToKill: 2 },
  [MINION_KIND.CANNON]: { health: 220, damagePerSecond: 11, range: 32, formationBack: 8, towerShotsToKill: 8 },
  [MINION_KIND.SUPER]: { health: 320, damagePerSecond: 22, range: 14, formationBack: 0, towerShotsToKill: 14 },
});

export const MINION_FIRST_SPAWN_SECONDS = 30;
export const MINION_WALK_SPEED = 22;
export const MINION_SPAWN_INTERVAL_SECONDS = 0.5;
export const MELEE_MINIONS_PER_WAVE = 3;
export const CASTER_MINIONS_PER_WAVE = 3;
// A lane with nobody defending it must not pile up minions without end.
export const MAX_MINIONS_PER_TEAM_IN_LANE = 30;
// Small differences between minions, so two equal waves don't die in perfect step and freeze the lane.
export const MINION_DAMAGE_JITTER = 0.08;

// From each time on, how often waves come and how often a wave brings a cannon.
const WAVE_SCHEDULE = Object.freeze([
  { fromSeconds: 0, intervalSeconds: 30, cannonEvery: 3 },
  { fromSeconds: 840, intervalSeconds: 25, cannonEvery: 2 },
  { fromSeconds: 1500, intervalSeconds: 25, cannonEvery: 1 },
  { fromSeconds: 1800, intervalSeconds: 20, cannonEvery: 1 },
]);

export function waveRulesAt(gameSeconds) {
  return WAVE_SCHEDULE.findLast(rules => gameSeconds >= rules.fromSeconds);
}

export const TOWER_SHOTS_PER_SECOND = 1.2;
export const TOWER_MINION_RANGE = 75;

// How far the wave front may move per second when it has to catch up with where the minions are.
export const FRONT_MAX_SPEED = 40;
// Minions this close to the front count as "at the front" for sieging, plays and farming.
export const FRONT_GROUP_RANGE = 70;

// What a shoving champion adds to the fight against the enemy wave.
export const SHOVE_CLEAR_DAMAGE_PER_SECOND = 35;
