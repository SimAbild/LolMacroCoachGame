// What the player wants to do, as plain objects with no references to game state.
// Screens create intents, executeCommand carries them out, and the tutorial can allow
// or block them. Because they are plain data, a script can replay them headless.
//   { type: INTENT.CHAMPION_ACTION, role: 'jungle', actionId: 'gankTop' }
//   { type: INTENT.CHAMPION_ACTION, role: 'top', actionId: 'callHelp', helperRole: 'jungle' }
//   { type: INTENT.CANCEL_ACTION, role: 'mid' }
//   { type: INTENT.TEAM_CALL, callId: 'contestObjective' }
export const INTENT = Object.freeze({
  CHAMPION_ACTION: 'championAction',
  CANCEL_ACTION: 'cancelAction',
  TEAM_CALL: 'teamCall',
});
