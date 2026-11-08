import { TICKS_PER_GAME_SECOND, TICK_SECONDS } from '../../config/gameRules.js';
import { updateLanes } from './laneSystem.js';
import { updateLaneOrders } from './laneOrderSystem.js';
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
import { updatePlays } from './playSystem.js';
import { updateIntel } from './intelSystem.js';
import { updateAlerts } from './alertSystem.js';

const SYSTEMS_IN_TICK_ORDER = Object.freeze([
  updateLanes,
  updateLaneOrders,
  updateStructures,
  updateJungle,
  updateObjectives,
  updateAiCoach,
  updateActions,
  updatePlays,
  updateTeamfights,
  updateBehavior,
  updateMovement,
  updateSustain,
  updateIncome,
  updateCooldownsAndWards,
  updateScouting,
  updateIntel,
  updateAlerts,
  updateGoldHistory,
]);

// shouldHalt is checked after every tick. When it returns true the loop stops on that exact tick
// and the leftover time is dropped, so input given while halted lands on the same tick every run.
export function createSimulation(gameState, { shouldHalt = null } = {}) {
  let unsimulatedSeconds = 0;

  function advance(gameSecondsDelta) {
    unsimulatedSeconds += gameSecondsDelta;
    while (unsimulatedSeconds >= TICK_SECONDS && !gameState.winner) {
      runTick();
      unsimulatedSeconds -= TICK_SECONDS;
      if (shouldHalt?.(gameState)) {
        unsimulatedSeconds = 0;
        return true;
      }
    }
    return false;
  }

  function runTicks(tickCount) {
    let ticksRun = 0;
    while (ticksRun < tickCount && !gameState.winner) {
      runTick();
      ticksRun += 1;
      if (shouldHalt?.(gameState)) {
        break;
      }
    }
    unsimulatedSeconds = 0;
    return ticksRun;
  }

  function runTick() {
    gameState.tickCount += 1;
    gameState.gameSeconds = gameState.tickCount / TICKS_PER_GAME_SECOND;
    for (const updateSystem of SYSTEMS_IN_TICK_ORDER) {
      updateSystem(gameState, TICK_SECONDS);
    }
  }

  // How far time has come toward the next tick (0 to 1), so the map can draw between two ticks.
  function tickProgress() {
    return unsimulatedSeconds / TICK_SECONDS;
  }

  return { advance, runTicks, tickProgress };
}
