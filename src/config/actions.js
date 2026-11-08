import { ROLE, ROLE_LABELS } from './roles.js';
import { TRINKET_MAX_CHARGES, WARD_DURATION_SECONDS } from './combatRules.js';

export const ACTION_KIND = Object.freeze({
  SHOVE: 'shove',
  SLOW_PUSH: 'slowPush',
  FREEZE: 'freeze',
  PLAY_SAFE: 'playSafe',
  TRADE: 'trade',
  RESET: 'reset',
  COVER: 'cover',
  DIVE: 'dive',
  CALL_HELP: 'callHelp',
  GANK: 'gank',
  FARM: 'farm',
  INVADE: 'invade',
  SETUP_OBJECTIVE: 'setupObjective',
  WARD: 'ward',
  GROUP: 'group',
  CONTEST: 'contest',
  ENGAGE: 'engage',
  RETREAT: 'retreat',
  PLAY_SETUP: 'playSetup',
});

export const TEAM_CALL = Object.freeze({
  ENGAGE: 'engage',
  CONTEST_OBJECTIVE: 'contestObjective',
  GROUP_MID: 'groupMid',
  BACK_OFF: 'backOff',
});

export const CALL_HELP_ACTION_ID = 'callHelp';

// A lane order lasts until the player changes it: one wave plan and one stance at a time.
export const LANE_ORDER_SLOT = Object.freeze({ WAVE: 'wave', POSTURE: 'posture' });

// Everything a call says is what the simulation really does: the tooltips and the tutorial use
// this text. pros, cons and bestWhen are shown under the description.
const LANER_CALLS = Object.freeze({
  slowPush: {
    id: 'slowPush',
    label: 'Slow push',
    kind: ACTION_KIND.SLOW_PUSH,
    orderSlot: LANE_ORDER_SLOT.WAVE,
    description: 'Kill their casters first and take last hits, so your wave outlasts theirs and grows into a big crash.',
    pros: 'Keeps your last hits, and the big crash costs them CS under their tower.',
    cons: 'Slow, ties you to the lane, and you stand far forward where a gank can reach you.',
    bestWhen: 'They are weakened, or a cannon wave is coming.',
  },
  shove: {
    id: 'shove',
    label: 'Shove',
    kind: ACTION_KIND.SHOVE,
    orderSlot: LANE_ORDER_SLOT.WAVE,
    description: 'Clear their wave as fast as you can, so yours crashes into their tower. Ends when it crashes.',
    pros: 'Quick. Your opponent has to farm under their tower, and you are free to roam, reset or ward.',
    cons: 'You miss last hits, stand far forward, and get nothing if you just wait in lane afterward.',
    bestWhen: 'You have a plan for afterward, best on a cannon wave.',
  },
  freeze: {
    id: 'freeze',
    label: 'Freeze',
    kind: ACTION_KIND.FREEZE,
    orderSlot: LANE_ORDER_SLOT.WAVE,
    description: 'Let their wave come to you and hold it just outside your tower, taking only last hits.',
    pros: 'They must walk up to you for every minion: they lose CS, or they stand where a gank can catch them.',
    cons: 'Ties you to the lane, and they can answer by roaming or bringing help.',
    bestWhen: 'You are ahead and they are low or have just come back from base.',
  },
  playSafe: {
    id: 'playSafe',
    label: 'Play safe',
    kind: ACTION_KIND.PLAY_SAFE,
    orderSlot: LANE_ORDER_SLOT.POSTURE,
    description: 'Stay well behind the wave, away from trades. Lasts until you change it.',
    pros: 'Much smaller trades, and much harder to gank.',
    cons: 'You miss last hits, so your opponent pulls ahead in CS.',
    bestWhen: 'You are behind, low on health, or their jungler is near.',
  },
  trade: {
    id: 'trade',
    label: 'Trade',
    kind: ACTION_KIND.TRADE,
    orderSlot: LANE_ORDER_SLOT.POSTURE,
    description: 'Step up and keep hitting your opponent. Stops by itself when your health runs low.',
    pros: 'They lose health and so last hits, and can be forced back to base.',
    cons: 'Costs mana and health, more if their wave is bigger than yours, and you stand within gank reach.',
    bestWhen: 'You are ahead in levels or items, or your wave is the bigger one.',
  },
  reset: {
    id: 'reset',
    label: 'Reset',
    kind: ACTION_KIND.RESET,
    description: 'Recall to base now to buy items and heal.',
    pros: 'Your items arrive on your timing, and you come back at full health.',
    cons: 'You miss the waves while gone, and a wave pushing toward you hits your tower.',
    bestWhen: 'Right after your wave has crashed into their tower.',
  },
  dive: {
    id: 'dive',
    label: 'Dive',
    kind: ACTION_KIND.DIVE,
    description: 'Shove the wave into their tower, then go in on your opponent under it.',
    pros: 'A kill, and they lose their lane time. A bigger wave takes more tower shots for you.',
    cons: 'Tower shots hurt, and dying there hands them gold and the lane.',
    bestWhen: 'They are low and a big wave is at their tower.',
  },
  callHelp: {
    id: CALL_HELP_ACTION_ID,
    label: 'Call help',
    kind: ACTION_KIND.CALL_HELP,
    description: 'Ask a teammate to come fight your lane opponent 2-v-1. Pick who helps in the row that opens.',
    pros: 'A good chance at a kill, and it can break a lead or a freeze.',
    cons: 'The helper stops farming and leaves their own lane or jungle open.',
    bestWhen: 'Your opponent stands far forward.',
  },
});

const roam = (lane, roamer) => ({
  id: `roam${lane.charAt(0).toUpperCase()}${lane.slice(1)}`,
  label: `Roam ${lane}`,
  kind: ACTION_KIND.GANK,
  targetRole: lane,
  targetLane: lane,
  description: roamer === ROLE.MID
    ? `Shove mid first, then walk to ${lane} lane for a 2-v-1.`
    : `Leave bot lane to gank ${lane} lane.`,
  pros: 'A kill and tempo for another lane.',
  cons: roamer === ROLE.MID
    ? 'You miss waves, and your opponent farms free or follows you.'
    : 'Your bot laner is alone and misses last hits while you are gone.',
  bestWhen: 'Your wave has just crashed, best a cannon wave.',
});

const gank = lane => ({
  id: `gank${lane.charAt(0).toUpperCase()}${lane.slice(1)}`,
  label: `Gank ${lane}`,
  kind: ACTION_KIND.GANK,
  targetRole: lane,
  targetLane: lane,
  description: `Walk through the jungle to an ambush beside ${lane} lane.`,
  pros: 'A kill, and a lead for that lane that keeps growing.',
  cons: 'Your camps wait, and a failed gank costs time and can be punished by their jungler.',
  bestWhen: 'The wave is near your tower, the target is low or has no Flash, and you are not spotted on the way.',
});

const objectiveWard = ({ id, label, pit, wardSpot }) => ({
  id,
  label,
  kind: ACTION_KIND.WARD,
  wardSpot,
  description: `Place a ward by the ${pit} pit (${WARD_DURATION_SECONDS}s of vision). Uses one of ${TRINKET_MAX_CHARGES} trinket charges.`,
  pros: 'You see who comes before the objective spawns.',
  cons: 'Your bot laner is alone during the walk.',
  bestWhen: 'About a minute before the objective spawns.',
});

const deepWard = ({ id, label, side, wardSpot }) => ({
  id,
  label,
  kind: ACTION_KIND.WARD,
  wardSpot,
  description: `Ward deep in their ${side}-side jungle to see where their jungler goes. Uses a trinket charge.`,
  pros: 'Warns your lanes before a gank arrives.',
  cons: 'A long walk that leaves your bot laner alone.',
  bestWhen: 'Your lanes are pushed up and their jungler is missing.',
});

const JUNGLE_CALLS = Object.freeze({
  farm: {
    id: 'farm',
    label: 'Farm',
    kind: ACTION_KIND.FARM,
    description: 'Go back to clearing camps. Cancels the current call.',
    pros: 'Steady gold and experience.',
    cons: 'No pressure on the map.',
    bestWhen: 'No lane offers a good gank.',
  },
  invade: {
    id: 'invade',
    label: 'Invade',
    kind: ACTION_KIND.INVADE,
    description: 'Sneak into the enemy jungle and steal their nearest camp.',
    pros: 'Their jungler loses a camp, and you gain its gold.',
    cons: 'If their team is close, it turns into a fight on their ground.',
    bestWhen: 'Their jungler was just seen far away.',
  },
  setupObjective: {
    id: 'setupObjective',
    label: 'Setup objective',
    kind: ACTION_KIND.SETUP_OBJECTIVE,
    description: 'Ward the next objective that is up or spawning soon.',
    pros: 'Vision and a head start on the objective.',
    cons: 'Time you could spend ganking or farming.',
    bestWhen: 'Half a minute to a minute before it spawns.',
  },
  cover: {
    id: 'cover',
    label: 'Cover',
    kind: ACTION_KIND.COVER,
    description: 'Stand near your most pushed lane for a while, ready to answer a gank.',
    pros: 'Punishes their gank, and makes a freeze or a dive much safer.',
    cons: 'You farm less while you wait.',
    bestWhen: 'One of your laners stands far forward.',
  },
  callHelp: {
    id: CALL_HELP_ACTION_ID,
    label: 'Call help',
    kind: ACTION_KIND.CALL_HELP,
    description: 'Ask a teammate to join you against their jungler. Pick who helps in the row that opens.',
    pros: 'Wins the fight in the jungle.',
    cons: 'The helper leaves their lane open.',
    bestWhen: 'Their jungler is in your jungle.',
  },
});

const LANE_ORDERS = Object.freeze([LANER_CALLS.slowPush, LANER_CALLS.shove, LANER_CALLS.freeze, LANER_CALLS.playSafe, LANER_CALLS.trade]);

export const ROLE_ACTIONS = Object.freeze({
  top: [...LANE_ORDERS, LANER_CALLS.dive, LANER_CALLS.reset, LANER_CALLS.callHelp],
  jungle: [
    JUNGLE_CALLS.farm, gank('top'), gank('mid'), gank('bot'), JUNGLE_CALLS.invade, JUNGLE_CALLS.setupObjective, JUNGLE_CALLS.cover, JUNGLE_CALLS.callHelp,
  ],
  mid: [...LANE_ORDERS, roam('top', ROLE.MID), roam('bot', ROLE.MID), LANER_CALLS.reset, LANER_CALLS.callHelp],
  bot: [...LANE_ORDERS, LANER_CALLS.dive, LANER_CALLS.reset, LANER_CALLS.callHelp],
  support: [
    LANER_CALLS.playSafe,
    LANER_CALLS.trade,
    objectiveWard({ id: 'wardObjectiveTop', label: 'Ward Baron', pit: 'Baron', wardSpot: 'objectiveTop' }),
    objectiveWard({ id: 'wardObjectiveBot', label: 'Ward Dragon', pit: 'Dragon', wardSpot: 'objectiveBot' }),
    deepWard({ id: 'deepWardTop', label: 'Deep ward top', side: 'top', wardSpot: 'deepTop' }),
    deepWard({ id: 'deepWardBot', label: 'Deep ward bot', side: 'bot', wardSpot: 'deepBot' }),
    roam('top', ROLE.SUPPORT),
    roam('mid', ROLE.SUPPORT),
    LANER_CALLS.callHelp,
  ],
});

export const TEAM_CALLS = Object.freeze([
  {
    id: TEAM_CALL.ENGAGE,
    label: 'Engage',
    description: 'Everyone available goes in on the closest visible enemy and starts a teamfight.',
    pros: 'You choose when the fight starts.',
    cons: 'Bad when you are behind in gold or numbers.',
    bestWhen: 'You are ahead and an enemy stands alone.',
  },
  {
    id: TEAM_CALL.CONTEST_OBJECTIVE,
    label: 'Contest objective',
    description: 'The team gathers by the next objective, then takes it and fights anyone who contests.',
    pros: 'The objective, and a fight on your terms.',
    cons: 'Laners who leave miss their waves, so shove first if you can.',
    bestWhen: 'Your lanes near the objective are pushed.',
  },
  {
    id: TEAM_CALL.GROUP_MID,
    label: 'Group mid',
    description: 'Everyone groups behind the mid wave and pushes together. A fight starts if two or more enemies come close.',
    pros: 'A strong push down mid.',
    cons: 'Side lanes slip back while nobody farms them.',
    bestWhen: 'After a won fight or with Baron.',
  },
  {
    id: TEAM_CALL.BACK_OFF,
    label: 'Back off',
    description: 'Everyone leaves their fights and team calls and retreats to safety.',
    pros: 'Saves lives from a lost fight.',
    cons: 'You give up the objective or the push.',
    bestWhen: 'The fight looks lost.',
  },
]);

export function findRoleAction(role, actionId) {
  return ROLE_ACTIONS[role].find(action => action.id === actionId);
}

export function findTeamCall(callId) {
  return TEAM_CALLS.find(teamCall => teamCall.id === callId);
}

export function describeHelpRequest(callerRole, helperRole) {
  const helper = ROLE_LABELS[helperRole];
  const caller = ROLE_LABELS[callerRole].toLowerCase();
  return callerRole === ROLE.JUNGLE
    ? `${helper} joins your jungler for a 2-v-1 against their jungler.`
    : `${helper} comes over and fights their ${caller} 2-v-1 together with your ${caller}.`;
}
