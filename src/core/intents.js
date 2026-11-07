// What the player wants to do, as plain objects with no references to game state.
// Screens create intents, executeCommand carries out the in-game ones, and the tutorial
// can allow or block any of them. Because they are plain data, a script can replay them headless.
//   { type: INTENT.CHAMPION_ACTION, role: 'jungle', actionId: 'gankTop' }
//   { type: INTENT.CHAMPION_ACTION, role: 'top', actionId: 'callHelp', helperRole: 'jungle' }
//   { type: INTENT.CANCEL_ACTION, role: 'mid' }
//   { type: INTENT.TEAM_CALL, callId: 'contestObjective' }
//   { type: INTENT.DRAFT_LOCK, championId: 'Zed' }
//   { type: INTENT.LOADOUT_SWAP, fromIndex: 0, toIndex: 1 }
//   { type: INTENT.LOADOUT_SPELL, role: 'support', spellSlot: 1, spellId: 'exhaust' }
export const INTENT = Object.freeze({
  // In game
  CHAMPION_ACTION: 'championAction',
  CANCEL_ACTION: 'cancelAction',
  TEAM_CALL: 'teamCall',
  SET_SPEED: 'setSpeed',
  TOGGLE_PAUSE: 'togglePause',
  // Draft
  DRAFT_SELECT: 'draftSelect',
  DRAFT_LOCK: 'draftLock',
  DRAFT_FILTER: 'draftFilter',
  DRAFT_AI_TURN: 'draftAiTurn',
  // Swap phase
  LOADOUT_SWAP: 'loadoutSwap',
  LOADOUT_BUILD: 'loadoutBuild',
  LOADOUT_SPELL: 'loadoutSpell',
  START_GAME: 'startGame',
  // End screen
  END_SCREEN_ACTION: 'endScreenAction',
});

// True when every field in the pattern has the same value in the intent.
// { type: 'teamCall' } matches any team call; { type: 'teamCall', callId: 'engage' } only Engage.
export function intentMatches(pattern, intent) {
  return Object.entries(pattern).every(([key, value]) => intent[key] === value);
}
