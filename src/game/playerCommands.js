import { INTENT } from '../core/intents.js';
import { findRoleAction, findTeamCall } from '../config/actions.js';
import { ROLE_LABELS } from '../config/roles.js';
import { cancelAction, issueAction } from './simulation/actionSystem.js';
import { issueTeamCall } from './simulation/teamCallSystem.js';

// Carries out one player intent. The game screen and headless tools both use this,
// so a replayed command runs exactly the same code as a click.
// Returns { isIssued: true } or { isIssued: false, reason }.
export function executeCommand(gameState, intent) {
  const handler = COMMAND_HANDLERS[intent.type];
  if (!handler) {
    return { isIssued: false, reason: `Unknown command: ${intent.type}` };
  }
  return handler(gameState, intent);
}

const COMMAND_HANDLERS = Object.freeze({
  [INTENT.CHAMPION_ACTION]: (gameState, { role, actionId, helperRole = null }) => {
    const championState = playerChampionWithRole(gameState, role);
    const actionDefinition = findRoleAction(role, actionId);
    const result = issueAction(gameState, championState, actionDefinition, { helperRole });
    if (result.isIssued) {
      const helperSuffix = helperRole ? ` with ${ROLE_LABELS[helperRole]}` : '';
      logPlayerCall(gameState, `${championState.champion.name}: ${actionDefinition.label}${helperSuffix}`);
    }
    return result;
  },
  [INTENT.CANCEL_ACTION]: (gameState, { role }) => {
    cancelAction(gameState, playerChampionWithRole(gameState, role));
    return { isIssued: true };
  },
  [INTENT.TEAM_CALL]: (gameState, { callId }) => {
    const result = issueTeamCall(gameState, gameState.playerSide, callId);
    if (result.isIssued) {
      logPlayerCall(gameState, findTeamCall(callId).label);
    }
    return result;
  },
});

function playerChampionWithRole(gameState, role) {
  return gameState.teams[gameState.playerSide].champions.find(championState => championState.role === role);
}

function logPlayerCall(gameState, label) {
  gameState.callLog.push({ gameSeconds: gameState.gameSeconds, label });
}
