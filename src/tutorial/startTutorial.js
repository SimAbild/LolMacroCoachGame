import { mountDraftScreen } from '../screens/draftScreen.js';
import { mountEndScreen } from '../screens/endScreen.js';
import { mountGameScreen } from '../screens/gameScreen.js';
import { createAutopilot } from './autopilot.js';
import { TUTORIAL_SIDE, createScenario } from './scenario.js';
import { createTutorialScript } from './chapters/tutorialScript.js';
import { createTutorialDirector } from './tutorialDirector.js';

const MOUNT_BY_SCREEN = Object.freeze({ game: mountGameScreen, end: mountEndScreen });

// "How to play": a guided game that starts in the draft, always on the blue side.
export function startTutorial({ router, gameData }) {
  const scenario = createScenario(gameData.champions);
  const director = createTutorialDirector({ router, steps: createTutorialScript(scenario), scenario });
  router.show(mountDraftScreen, { gameData, playerSide: TUTORIAL_SIDE, tutorial: director });
  director.start();
}

// For testing a late chapter without playing up to it. The autopilot plays everything before the
// chapter, then the director takes over on the same steps and game. `chapterKey` is the first
// part of a step id ("baron" for "baron.skip"). The draft cannot be entered halfway, so its
// chapters simply start from the beginning.
export function startTutorialAtChapter({ router, gameData, chapterKey }) {
  const scenario = createScenario(gameData.champions);
  const steps = createTutorialScript(scenario);
  const firstStep = steps.find(step => step.id.startsWith(`${chapterKey}.`));
  if (!firstStep) {
    throw new Error(`The tutorial has no chapter "${chapterKey}"`);
  }
  const mountScreen = MOUNT_BY_SCREEN[firstStep.screen];
  if (!mountScreen) {
    startTutorial({ router, gameData });
    return;
  }
  const autopilot = createAutopilot({ steps, scenario, gameData, onProblem: problem => console.warn(`[tutorial] ${problem}`) });
  autopilot.playUpToStep(firstStep.id);
  const director = createTutorialDirector({ router, steps, scenario });
  router.show(mountScreen, { gameData, playerSide: TUTORIAL_SIDE, loadouts: autopilot.loadouts, gameState: autopilot.gameState, tutorial: director });
  director.startAt(firstStep.id);
}
