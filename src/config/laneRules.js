// Last hits: a champion goes for an enemy minion once its health is this low, and tries again this often.
export const LAST_HIT_HEALTH_RATIO = 0.3;
export const LAST_HIT_ATTEMPT_SECONDS = 0.8;
export const LAST_HIT_BASE_CHANCE = 0.85;
export const LAST_HIT_MIN_CHANCE = 0.1;
export const LAST_HIT_MAX_CHANCE = 0.98;
// How much the lane's pressure moves the chance: with full pressure, this much more or less.
export const LAST_HIT_PRESSURE_EFFECT = 0.3;
export const LAST_HIT_SAFE_FACTOR = 0.7;
export const LAST_HIT_SHOVE_FACTOR = 0.7;
// A minion the tower is shooting at is much harder to time.
export const LAST_HIT_UNDER_TOWER_FACTOR = 0.65;
export const LAST_HIT_UNDER_TOWER_RANGE = 120;

// Going for a last hit means stepping up to the wave for a moment.
export const LAST_HIT_STEP_DISTANCE = 16;
export const LAST_HIT_STEP_SECONDS = 0.7;

// Experience reaches further than last hits do, so a zoned champion can still soak it from behind.
export const EXPERIENCE_RANGE = 110;

// Lane pressure runs from -1 to 1 for a team: who has the upper hand in this lane right now.
export const PRESSURE_PER_LEVEL = 0.12;
export const PRESSURE_PER_THOUSAND_ITEM_GOLD = 0.15;
export const PRESSURE_PER_HEALTH = 0.6;
export const PRESSURE_WITH_LANE_ALONE = 0.5;
// Under pressure a champion stands further back; with the upper hand, a little further up.
export const ZONED_EXTRA_STANDOFF = 40;
export const FORWARD_STANDOFF = 8;
// Trades go worse for the team under pressure, which makes a lead grow by itself.
export const LANE_TRADE_PRESSURE_EFFECT = 0.6;
