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
import { updateStructures } from './structureSystem.js';
import { updateObjectives } from './objectiveSystem.js';
import { updateTeamfights } from './teamfightSystem.js';
import { updateGoldHistory } from './statsSystem.js';

const SYSTEMS_IN_TICK_ORDER = Object.freeze([
  updateLanes,
  updateStructures,
  updateJungle,
  updateObjectives,
  updateAiCoach,
  updateActions,
  updateTeamfights,
  updateBehavior,
  updateMovement,
  updateSustain,
  updateIncome,
  updateCooldownsAndWards,
  updateScouting,
  updateGoldHistory,
]);

export function createSimulation(gameState) {
  let unsimulatedSeconds = 0;

  function advance(gameSecondsDelta) {
    unsimulatedSeconds += gameSecondsDelta;
    while (unsimulatedSeconds >= TICK_SECONDS && !gameState.winner) {
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
