import { CHAMPION_MOVE_SPEED } from '../../config/gameRules.js';
import { allChampionStates } from '../gameState.js';

export function updateMovement(gameState, tickSeconds) {
  for (const championState of allChampionStates(gameState)) {
    if (championState.targetPosition) {
      moveToward(championState, championState.targetPosition, CHAMPION_MOVE_SPEED * tickSeconds);
    }
  }
}

function moveToward(championState, target, maxStep) {
  const deltaX = target.x - championState.position.x;
  const deltaY = target.y - championState.position.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= maxStep) {
    championState.position = { x: target.x, y: target.y };
    return;
  }
  championState.position = {
    x: championState.position.x + (deltaX / distance) * maxStep,
    y: championState.position.y + (deltaY / distance) * maxStep,
  };
}
