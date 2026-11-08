// Last hits: a champion goes for an enemy minion once its health is this low, and tries again this often.
export const LAST_HIT_HEALTH_RATIO = 0.3;
export const LAST_HIT_ATTEMPT_SECONDS = 0.8;
export const LAST_HIT_BASE_CHANCE = 0.85;
export const LAST_HIT_MIN_CHANCE = 0.1;
export const LAST_HIT_MAX_CHANCE = 0.98;
// How much the lane's pressure moves the chance: with full pressure, this much more or less.
export const LAST_HIT_PRESSURE_EFFECT = 0.3;
export const LAST_HIT_SAFE_FACTOR = 0.7;
export const LAST_HIT_SHOVE_FACTOR = 0.6;
// Shoving spends abilities on minions, so it runs a mana champion dry and sends them home.
export const SHOVE_MANA_COST_PER_SECOND = 0.006;
// A minion the tower is shooting at is harder to time.
export const LAST_HIT_UNDER_TOWER_FACTOR = 0.8;
export const LAST_HIT_UNDER_TOWER_RANGE = 120;

// Wave plans: when a wave counts as crashed, and how long the plan can last without one.
export const CRASH_PUSH_MARGIN = 2;
export const SHOVE_MINIONS_FOR_A_CRASH = 3;
export const SHOVE_MAX_SECONDS = 60;
export const SLOW_PUSH_MINIONS_FOR_A_CRASH = 5;
export const SLOW_PUSH_MAX_SECONDS = 120;
// A slow pusher only hits their casters, far less than a shove, and still takes every last hit.
export const SLOW_PUSH_DAMAGE_PER_SECOND = 9;

// Freeze: the freezer thins their own minions until the enemy wave wins and walks to them, then the
// enemy wave stops this far outside the tower's reach. With fewer of their own minions to wear the
// enemy down, the freezer finishes minions from higher up, so their farm keeps coming.
export const FREEZE_HOLD_MARGIN = 35;
export const FREEZE_THIN_DAMAGE_PER_SECOND = 10;
export const FREEZE_LAST_HIT_HEALTH_RATIO = 0.65;
// While the wave is still further than this from the hold point, more of their own wave is let die.
export const FREEZE_HOLD_SLACK = 40;
export const FREEZE_PULL_BACK_DAMAGE_PER_SECOND = 26;
// What it does to the other side: they must walk up to the wave, and last hits come harder.
export const FROZEN_OUT_STANDOFF = 32;
export const FROZEN_OUT_LAST_HIT_FACTOR = 0.55;
export const FROZEN_OUT_EXPERIENCE_FACTOR = 0.6;

// Trade: step up and hit the opponent, who takes far more. It costs more than normal trading,
// and even more with their bigger wave around you.
export const TRADE_STANDOFF_FORWARD = 10;
export const TRADE_DAMAGE_DEALT_FACTOR = 2.2;
export const TRADE_DAMAGE_TAKEN_FACTOR = 1.2;
export const TRADE_MINION_AGGRO_FACTOR = 1.5;
export const TRADE_MANA_COST_FACTOR = 1.6;
export const TRADE_LAST_HIT_FACTOR = 0.9;
export const TRADE_STOP_HEALTH = 0.4;

// A dive goes better with minions at the tower to take its shots.
export const DIVE_WAVE_BONUS_PER_MINION = 0.03;
export const DIVE_MAX_WAVE_BONUS = 0.15;
export const DIVE_NO_WAVE_PENALTY = -0.15;

// Going for a last hit means stepping up to the wave for a moment.
export const LAST_HIT_STEP_DISTANCE = 16;
export const LAST_HIT_STEP_SECONDS = 0.7;

// A laner normally misses a minion now and then; the kill feed only speaks up about real losses.
export const LOST_CREEPS_REPORT_MINIMUM = 4;

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
