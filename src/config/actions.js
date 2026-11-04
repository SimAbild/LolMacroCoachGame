export const CALL_HELP_ACTION_ID = 'callHelp';

export const ROLE_ACTIONS = Object.freeze({
  top: [
    { id: 'shove', label: 'Shove' },
    { id: 'playSafe', label: 'Play safe' },
    { id: 'dive', label: 'Dive' },
    { id: CALL_HELP_ACTION_ID, label: 'Call help' },
  ],
  jungle: [
    { id: 'farm', label: 'Farm' },
    { id: 'gankTop', label: 'Gank top', targetRole: 'top' },
    { id: 'gankMid', label: 'Gank mid', targetRole: 'mid' },
    { id: 'gankBot', label: 'Gank bot', targetRole: 'bot' },
    { id: 'invade', label: 'Invade' },
    { id: 'setupObjective', label: 'Setup objective' },
  ],
  mid: [
    { id: 'shove', label: 'Shove' },
    { id: 'playSafe', label: 'Play safe' },
    { id: 'roamTop', label: 'Roam top', targetRole: 'top' },
    { id: 'roamBot', label: 'Roam bot', targetRole: 'bot' },
    { id: CALL_HELP_ACTION_ID, label: 'Call help' },
  ],
  bot: [
    { id: 'shove', label: 'Shove' },
    { id: 'playSafe', label: 'Play safe' },
    { id: 'dive', label: 'Dive' },
    { id: CALL_HELP_ACTION_ID, label: 'Call help' },
  ],
  support: [
    { id: 'wardObjectiveTop', label: 'Ward obj. top' },
    { id: 'wardObjectiveBot', label: 'Ward obj. bot' },
    { id: 'deepWardTop', label: 'Deep ward top' },
    { id: 'deepWardBot', label: 'Deep ward bot' },
    { id: 'roamMid', label: 'Roam mid', targetRole: 'mid' },
  ],
});

export const TEAM_CALLS = Object.freeze([
  { id: 'engage', label: 'Engage' },
  { id: 'contestObjective', label: 'Contest objective' },
  { id: 'groupMid', label: 'Group mid' },
  { id: 'backOff', label: 'Back off' },
]);
