import { mountDraftScreen } from '../screens/draftScreen.js';
import { TUTORIAL_SIDE, createScenario } from './scenario.js';
import { createTutorialScript } from './chapters/tutorialScript.js';
import { createTutorialDirector } from './tutorialDirector.js';

// "How to play": a guided game that starts in the draft, always on the blue side.
export function startTutorial({ router, gameData }) {
  const scenario = createScenario(gameData.champions);
  const director = createTutorialDirector({ router, steps: createTutorialScript(scenario), scenario });
  router.show(mountDraftScreen, { gameData, playerSide: TUTORIAL_SIDE, tutorial: director });
  director.start();
}
