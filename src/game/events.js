const MAX_STORED_EVENTS = 60;

export const EVENT_KIND = Object.freeze({
  KILL: 'kill',
  FIGHT: 'fight',
  CALL: 'call',
  STRUCTURE: 'structure',
  OBJECTIVE: 'objective',
  TEAMFIGHT: 'teamfight',
});

export function addEvent(gameState, { kind, team, text }) {
  gameState.events.push({ kind, team, text, gameSeconds: gameState.gameSeconds });
  if (gameState.events.length > MAX_STORED_EVENTS) {
    gameState.events.shift();
  }
}
