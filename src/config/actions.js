import { ROLE, ROLE_LABELS } from './roles.js';
import { PLAY_SAFE_SECONDS, TRINKET_MAX_CHARGES, WARD_DURATION_SECONDS } from './combatRules.js';

export const ACTION_KIND = Object.freeze({
  SHOVE: 'shove',
  PLAY_SAFE: 'playSafe',
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

// Descriptions are shown in tooltips and reused by the tutorial, so they describe what the simulation really does.
const DESCRIPTIONS = Object.freeze({
  shove: 'Push the wave into their tower. More gold and pressure, but your laner stands further forward and is easier to gank.',
  playSafe: `Stay back near your own tower for ${PLAY_SAFE_SECONDS}s. Smaller trades, and much harder to gank.`,
  dive: 'Shove the wave into their tower, then go in on their laner under it. Strong when they are low; tower shots make it risky.',
  laneCallHelp: 'Ask a teammate to come to this lane and fight your lane opponent 2-v-1. Pick who helps in the row that opens.',
  jungleCallHelp: 'Ask a teammate to join your jungler against their jungler. Pick who helps in the row that opens.',
  farm: 'Go back to clearing camps. Cancels the current call.',
  gank: lane => `Walk through the jungle to an ambush beside ${lane} lane. Best when the wave is near your tower, the target is low or has no Flash, and you are not spotted on the way.`,
  invade: 'Sneak into the enemy jungle and steal their nearest camp. Risky if their team is close.',
  setupObjective: 'Ward the next objective that is up or spawning soon, so your team sees who comes.',
  midRoam: lane => `Shove mid first, then walk to ${lane} lane for a 2-v-1. Mid lane is empty while you are gone.`,
  supportRoam: lane => `Leave bot lane to gank ${lane} lane. Your bot laner is alone while you are gone.`,
  objectiveWard: pit => `Place a ward by the ${pit} pit (${WARD_DURATION_SECONDS}s of vision). Uses one of ${TRINKET_MAX_CHARGES} trinket charges.`,
  deepWard: side => `Ward deep in their ${side}-side jungle to see where their jungler goes. Uses a trinket charge.`,
});

export const ROLE_ACTIONS = Object.freeze({
  top: [
    { id: 'shove', label: 'Shove', kind: ACTION_KIND.SHOVE, description: DESCRIPTIONS.shove },
    { id: 'playSafe', label: 'Play safe', kind: ACTION_KIND.PLAY_SAFE, description: DESCRIPTIONS.playSafe },
    { id: 'dive', label: 'Dive', kind: ACTION_KIND.DIVE, description: DESCRIPTIONS.dive },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP, description: DESCRIPTIONS.laneCallHelp },
  ],
  jungle: [
    { id: 'farm', label: 'Farm', kind: ACTION_KIND.FARM, description: DESCRIPTIONS.farm },
    { id: 'gankTop', label: 'Gank top', kind: ACTION_KIND.GANK, targetRole: 'top', targetLane: 'top', description: DESCRIPTIONS.gank('top') },
    { id: 'gankMid', label: 'Gank mid', kind: ACTION_KIND.GANK, targetRole: 'mid', targetLane: 'mid', description: DESCRIPTIONS.gank('mid') },
    { id: 'gankBot', label: 'Gank bot', kind: ACTION_KIND.GANK, targetRole: 'bot', targetLane: 'bot', description: DESCRIPTIONS.gank('bot') },
    { id: 'invade', label: 'Invade', kind: ACTION_KIND.INVADE, description: DESCRIPTIONS.invade },
    { id: 'setupObjective', label: 'Setup objective', kind: ACTION_KIND.SETUP_OBJECTIVE, description: DESCRIPTIONS.setupObjective },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP, description: DESCRIPTIONS.jungleCallHelp },
  ],
  mid: [
    { id: 'shove', label: 'Shove', kind: ACTION_KIND.SHOVE, description: DESCRIPTIONS.shove },
    { id: 'playSafe', label: 'Play safe', kind: ACTION_KIND.PLAY_SAFE, description: DESCRIPTIONS.playSafe },
    { id: 'roamTop', label: 'Roam top', kind: ACTION_KIND.GANK, targetRole: 'top', targetLane: 'top', description: DESCRIPTIONS.midRoam('top') },
    { id: 'roamBot', label: 'Roam bot', kind: ACTION_KIND.GANK, targetRole: 'bot', targetLane: 'bot', description: DESCRIPTIONS.midRoam('bot') },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP, description: DESCRIPTIONS.laneCallHelp },
  ],
  bot: [
    { id: 'shove', label: 'Shove', kind: ACTION_KIND.SHOVE, description: DESCRIPTIONS.shove },
    { id: 'playSafe', label: 'Play safe', kind: ACTION_KIND.PLAY_SAFE, description: DESCRIPTIONS.playSafe },
    { id: 'dive', label: 'Dive', kind: ACTION_KIND.DIVE, description: DESCRIPTIONS.dive },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP, description: DESCRIPTIONS.laneCallHelp },
  ],
  support: [
    { id: 'wardObjectiveTop', label: 'Ward Baron', kind: ACTION_KIND.WARD, wardSpot: 'objectiveTop', description: DESCRIPTIONS.objectiveWard('Baron') },
    { id: 'wardObjectiveBot', label: 'Ward Dragon', kind: ACTION_KIND.WARD, wardSpot: 'objectiveBot', description: DESCRIPTIONS.objectiveWard('Dragon') },
    { id: 'deepWardTop', label: 'Deep ward top', kind: ACTION_KIND.WARD, wardSpot: 'deepTop', description: DESCRIPTIONS.deepWard('top') },
    { id: 'deepWardBot', label: 'Deep ward bot', kind: ACTION_KIND.WARD, wardSpot: 'deepBot', description: DESCRIPTIONS.deepWard('bot') },
    { id: 'roamTop', label: 'Roam top', kind: ACTION_KIND.GANK, targetRole: 'top', targetLane: 'top', description: DESCRIPTIONS.supportRoam('top') },
    { id: 'roamMid', label: 'Roam mid', kind: ACTION_KIND.GANK, targetRole: 'mid', targetLane: 'mid', description: DESCRIPTIONS.supportRoam('mid') },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP, description: DESCRIPTIONS.laneCallHelp },
  ],
});

export const TEAM_CALLS = Object.freeze([
  { id: TEAM_CALL.ENGAGE, label: 'Engage', description: 'Everyone available goes in on the closest visible enemy and starts a teamfight.' },
  { id: TEAM_CALL.CONTEST_OBJECTIVE, label: 'Contest objective', description: 'The team gathers by the next objective, then takes it and fights anyone who contests.' },
  { id: TEAM_CALL.GROUP_MID, label: 'Group mid', description: 'Everyone groups behind the mid wave and pushes together. A fight starts if two or more enemies come close.' },
  { id: TEAM_CALL.BACK_OFF, label: 'Back off', description: 'Everyone leaves their fights and team calls and retreats to safety.' },
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
