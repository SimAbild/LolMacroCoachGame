import { TICK_SECONDS } from '../../config/gameRules.js';
import { updateLanes } from './laneSystem.js';
import { updateJungle } from './jungleSystem.js';
import { updateBehavior } from './behaviorSystem.js';
import { updateMovement } from './movementSystem.js';
import { updateSustain } from './sustainSystem.js';
import { updateIncome } from './incomeSystem.js';
import { updateScouting } from './scoutingSystem.js';
import { updateActions } from './actionSystem.js';
import { updateCooldownsAndWards } from './cooldownSystem.js';
import { updateAiCoach } from './aiCoachSystem.js';

const SYSTEMS_IN_TICK_ORDER = Object.freeze([
  updateLanes,
  updateJungle,
  updateAiCoach,
  updateActions,
  updateBehavior,
  updateMovement,
  updateSustain,
  updateIncome,
  updateCooldownsAndWards,
  updateScouting,
]);

export function createSimulation(gameState) {
  let unsimulatedSeconds = 0;

  function advance(gameSecondsDelta) {
    unsimulatedSeconds += gameSecondsDelta;
    while (unsimulatedSeconds >= TICK_SECONDS) {
      runTick();
      unsimulatedSeconds -= TICK_SECONDS;
    }
  }

  function runTick() {
    gameState.gameSeconds += TICK_SECONDS;
    for (const updateSystem of SYSTEMS_IN_TICK_ORDER) {
      updateSystem(gameState, TICK_SECONDS);
    }
  }

  return { advance };
}
