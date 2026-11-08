import { CHAMPION_MOVE_SPEED } from '../../config/gameRules.js';
import { allChampionStates } from '../gameState.js';
import { findPath, hasLineOfSight } from '../navigation.js';
import { distanceBetween } from '../geometry.js';

const REPATH_DISTANCE = 20;

export function updateMovement(gameState, tickSeconds) {
  for (const championState of allChampionStates(gameState)) {
    // Taken after this tick's Flash and respawns, so the map draws a jump as a jump, not a slide.
    championState.previousPosition = championState.position;
    const destination = movementDestination(gameState, championState);
    if (!destination || !championState.isAlive) {
      championState.path = null;
      continue;
    }
    refreshPath(championState, destination);
    moveAlongPath(championState, CHAMPION_MOVE_SPEED * tickSeconds);
  }
}

function movementDestination(gameState, championState) {
  if (!championState.inFightId) {
    return championState.targetPosition;
  }
  const fight = gameState.fights.find(candidate => candidate.id === championState.inFightId);
  return championState.fightDestination ?? fight?.location ?? championState.targetPosition;
}

function refreshPath(championState, destination) {
  if (hasLineOfSight(championState.position, destination)) {
    championState.path = [{ x: destination.x, y: destination.y }];
    championState.pathGoal = { x: destination.x, y: destination.y };
    return;
  }
  const goalHasMoved = !championState.pathGoal
    || distanceBetween(championState.pathGoal, destination) > REPATH_DISTANCE;
  if (!championState.path || championState.path.length === 0 || goalHasMoved) {
    championState.path = findPath(championState.position, destination);
    championState.pathGoal = { x: destination.x, y: destination.y };
  }
}

function moveAlongPath(championState, maxStep) {
  let remainingStep = maxStep;
  while (remainingStep > 0 && championState.path.length > 0) {
    const waypoint = championState.path[0];
    const deltaX = waypoint.x - championState.position.x;
    const deltaY = waypoint.y - championState.position.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= remainingStep) {
      championState.position = { x: waypoint.x, y: waypoint.y };
      championState.path.shift();
      remainingStep -= distance;
      continue;
    }
    championState.position = {
      x: championState.position.x + (deltaX / distance) * remainingStep,
      y: championState.position.y + (deltaY / distance) * remainingStep,
    };
    remainingStep = 0;
  }
}
