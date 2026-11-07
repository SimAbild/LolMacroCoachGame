import { PAUSE_REASON } from '../../game/gameClock.js';
import { fastForward } from '../../game/fastForward.js';
import { STEP_KIND } from '../../tutorial/tutorialRunner.js';

// Tutorial steps the game holds still for: the player reads, makes the one highlighted call,
// or watches a time jump.
const HOLD_KINDS = new Set([STEP_KIND.DIALOG, STEP_KIND.DO, STEP_KIND.SKIP]);

// What the tutorial may ask of the game screen (see tutorialDirector.js). The tutorial pauses
// with its own reason, so the player's Space cannot lift a tutorial hold.
export function createGameTutorialApi({ gameState, simulation, clock, layout, alertWatcher }) {
  return {
    context: () => ({ gameState }),
    checksWaitsEachTick: true,
    onStepShown: step => {
      if (HOLD_KINDS.has(step.kind)) {
        clock.pause(PAUSE_REASON.TUTORIAL);
      } else {
        clock.resume(PAUSE_REASON.TUTORIAL);
      }
    },
    fastForwardTo: toSeconds => fastForward(simulation, gameState, {
      toSeconds,
      onFrame: () => {
        layout.mapPanel.update(gameState);
        layout.refresh();
      },
    }),
    // Alerts from the skipped minutes are old news: don't replay them all at once.
    afterSkip: () => {
      alertWatcher.markAllShown(gameState);
      layout.refresh();
    },
    worldToClient: point => layout.mapPanel.worldToClient(point),
    onDialogOpen: () => clock.pause(PAUSE_REASON.DIALOG),
    onDialogClose: () => clock.resume(PAUSE_REASON.DIALOG),
  };
}
