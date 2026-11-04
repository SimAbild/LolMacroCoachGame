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

export const ROLE_ACTIONS = Object.freeze({
  top: [
    { id: 'shove', label: 'Shove', kind: ACTION_KIND.SHOVE },
    { id: 'playSafe', label: 'Play safe', kind: ACTION_KIND.PLAY_SAFE },
    { id: 'dive', label: 'Dive', kind: ACTION_KIND.DIVE },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP },
  ],
  jungle: [
    { id: 'farm', label: 'Farm', kind: ACTION_KIND.FARM },
    { id: 'gankTop', label: 'Gank top', kind: ACTION_KIND.GANK, targetRole: 'top', targetLane: 'top' },
    { id: 'gankMid', label: 'Gank mid', kind: ACTION_KIND.GANK, targetRole: 'mid', targetLane: 'mid' },
    { id: 'gankBot', label: 'Gank bot', kind: ACTION_KIND.GANK, targetRole: 'bot', targetLane: 'bot' },
    { id: 'invade', label: 'Invade', kind: ACTION_KIND.INVADE },
    { id: 'setupObjective', label: 'Setup objective', kind: ACTION_KIND.SETUP_OBJECTIVE },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP },
  ],
  mid: [
    { id: 'shove', label: 'Shove', kind: ACTION_KIND.SHOVE },
    { id: 'playSafe', label: 'Play safe', kind: ACTION_KIND.PLAY_SAFE },
    { id: 'roamTop', label: 'Roam top', kind: ACTION_KIND.GANK, targetRole: 'top', targetLane: 'top' },
    { id: 'roamBot', label: 'Roam bot', kind: ACTION_KIND.GANK, targetRole: 'bot', targetLane: 'bot' },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP },
  ],
  bot: [
    { id: 'shove', label: 'Shove', kind: ACTION_KIND.SHOVE },
    { id: 'playSafe', label: 'Play safe', kind: ACTION_KIND.PLAY_SAFE },
    { id: 'dive', label: 'Dive', kind: ACTION_KIND.DIVE },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP },
  ],
  support: [
    { id: 'wardObjectiveTop', label: 'Ward obj. top', kind: ACTION_KIND.WARD, wardSpot: 'objectiveTop' },
    { id: 'wardObjectiveBot', label: 'Ward obj. bot', kind: ACTION_KIND.WARD, wardSpot: 'objectiveBot' },
    { id: 'deepWardTop', label: 'Deep ward top', kind: ACTION_KIND.WARD, wardSpot: 'deepTop' },
    { id: 'deepWardBot', label: 'Deep ward bot', kind: ACTION_KIND.WARD, wardSpot: 'deepBot' },
    { id: 'roamTop', label: 'Roam top', kind: ACTION_KIND.GANK, targetRole: 'top', targetLane: 'top' },
    { id: 'roamMid', label: 'Roam mid', kind: ACTION_KIND.GANK, targetRole: 'mid', targetLane: 'mid' },
    { id: CALL_HELP_ACTION_ID, label: 'Call help', kind: ACTION_KIND.CALL_HELP },
  ],
});

export const TEAM_CALLS = Object.freeze([
  { id: TEAM_CALL.ENGAGE, label: 'Engage' },
  { id: TEAM_CALL.CONTEST_OBJECTIVE, label: 'Contest objective' },
  { id: TEAM_CALL.GROUP_MID, label: 'Group mid' },
  { id: TEAM_CALL.BACK_OFF, label: 'Back off' },
]);
