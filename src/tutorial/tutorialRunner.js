import { INTENT, intentMatches } from '../core/intents.js';

// The kinds of tutorial step, and what each lets the player do:
//   dialog: read and press Next; nothing else works.
//   do:     the one highlighted action (`expect`, plus helper actions in `allow`) works; it moves on when done.
//   watch:  the game or draft plays on until `until(context)` is true; only speed and pause work.
//   skip:   time jumps forward (fast-forward); nothing works.
//   free:   everything works.
export const STEP_KIND = Object.freeze({ DIALOG: 'dialog', DO: 'do', WATCH: 'watch', SKIP: 'skip', FREE: 'free' });

const ALWAYS_ALLOWED_WHILE_WATCHING = Object.freeze([{ type: INTENT.SET_SPEED }, { type: INTENT.TOGGLE_PAUSE }]);

// Steps through a list of tutorial steps. It knows nothing about the DOM: the director shows the
// steps on screen, and tools/checkTutorial.mjs drives the same runner headless.
export function createTutorialRunner(steps, { onStepEntered, onFinished }) {
  const indexById = new Map(steps.map((step, index) => [step.id, index]));
  let currentIndex = -1;

  function enterStep(index) {
    currentIndex = index;
    const step = steps[index];
    if (step) {
      onStepEntered(step);
    } else {
      onFinished();
    }
  }

  // Moves to `nextId`, or the step's own `next`, or simply the following step.
  function advance(nextId = steps[currentIndex].next) {
    enterStep(nextId ? indexOfStep(nextId) : currentIndex + 1);
  }

  function indexOfStep(stepId) {
    if (!indexById.has(stepId)) {
      throw new Error(`Tutorial step "${stepId}" does not exist`);
    }
    return indexById.get(stepId);
  }

  return {
    start: () => enterStep(0),
    goTo: stepId => enterStep(indexOfStep(stepId)),
    currentStep: () => steps[currentIndex] ?? null,
    canAct: intent => isAllowed(steps[currentIndex], intent),
    // The player did something: a `do` step moves on when it was the expected action.
    notify: intent => {
      const step = steps[currentIndex];
      if (step?.kind === STEP_KIND.DO && intentMatches(step.expect, intent)) {
        advance();
      }
    },
    // Next on a dialog.
    next: () => {
      if (steps[currentIndex]?.kind === STEP_KIND.DIALOG) {
        advance();
      }
    },
    isWaitOver: context => isWaitOver(steps[currentIndex], context),
    // A watch or free step moves on once its condition holds.
    advanceIfWaitOver: context => {
      if (isWaitOver(steps[currentIndex], context)) {
        advance();
      }
    },
    advance,
  };
}

function isAllowed(step, intent) {
  if (!step) {
    return true;
  }
  const allowedPatterns = {
    [STEP_KIND.DIALOG]: [],
    [STEP_KIND.SKIP]: [],
    [STEP_KIND.DO]: [step.expect, ...(step.allow ?? [])],
    [STEP_KIND.WATCH]: [...ALWAYS_ALLOWED_WHILE_WATCHING, ...(step.allow ?? [])],
  }[step.kind];
  return allowedPatterns ? allowedPatterns.some(pattern => intentMatches(pattern, intent)) : true;
}

function isWaitOver(step, context) {
  const isWaitingStep = step?.kind === STEP_KIND.WATCH || step?.kind === STEP_KIND.FREE;
  return Boolean(isWaitingStep && step.until?.(context));
}
