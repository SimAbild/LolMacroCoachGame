import { TICKS_PER_GAME_SECOND } from '../config/gameRules.js';

// Real time spent simulating per animation frame. The rest of the frame is left for drawing,
// so the page stays responsive and the map shows the jump as a time-lapse.
const FRAME_BUDGET_MS = 8;
const TICKS_PER_BATCH = 20;

// Runs the simulation to exactly `toSeconds`, spread over animation frames. Because it counts
// whole ticks, the result is the same as running all the ticks at once (as the headless check does).
// onFrame() runs after each frame's batch, to redraw. Resolves when the time is reached or the game ends.
export function fastForward(simulation, gameState, { toSeconds, onFrame }) {
  const targetTick = Math.round(toSeconds * TICKS_PER_GAME_SECOND);
  // A simulation that halts (runs no ticks) also ends the jump, instead of looping forever.
  let hasStalled = false;
  const isDone = () => hasStalled || gameState.tickCount >= targetTick || Boolean(gameState.winner);
  return new Promise(resolve => {
    function runFrame() {
      const deadline = performance.now() + FRAME_BUDGET_MS;
      while (!isDone() && performance.now() < deadline) {
        hasStalled = simulation.runTicks(Math.min(TICKS_PER_BATCH, targetTick - gameState.tickCount)) === 0;
      }
      onFrame();
      if (isDone()) {
        resolve();
      } else {
        requestAnimationFrame(runFrame);
      }
    }
    requestAnimationFrame(runFrame);
  });
}
