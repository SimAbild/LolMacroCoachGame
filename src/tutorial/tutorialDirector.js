import { DIALOG_TONE, confirmDialog } from '../ui/dialog.js';
import { ScriptedDraftAi } from '../draft/scriptedDraftAi.js';
import { mountHomeScreen } from '../screens/homeScreen.js';
import { createTutorialRunner } from './tutorialRunner.js';
import { createCoachMark } from './ui/coachMark.js';

// Connects the tutorial steps to the screens. The draft, game and end screens receive this
// object as `tutorial` and call attach / canAct / notify; a normal game gets NO_TUTORIAL instead.
// Each screen attaches with an api: { context() } plus optional hooks: onStepShown(step), and
// onDialogOpen() / onDialogClose() so a running game can pause while "Exit tutorial" asks.
export function createTutorialDirector({ router, steps, scenario }) {
  const coachMark = createCoachMark({ findTargetRects, onNext: () => runner.next(), onExit: confirmExit });
  const runner = createTutorialRunner(steps, { onStepEntered: showStepIfOnScreen, onFinished: finish });
  const warnedMissingTargets = new Set();
  let attachedScreen = null;
  let waitFrameId = null;

  function attach(screenId, api) {
    attachedScreen = { screenId, api };
    showStepIfOnScreen(runner.currentStep());
    waitFrameId = requestAnimationFrame(checkWaitEachFrame);
    return () => {
      attachedScreen = null;
      cancelAnimationFrame(waitFrameId);
      coachMark.hide();
    };
  }

  // A step is only shown once the screen it belongs to is attached.
  function showStepIfOnScreen(step) {
    if (!step || step.screen !== attachedScreen?.screenId) {
      coachMark.hide();
      return;
    }
    attachedScreen.api.onStepShown?.(step);
    scrollTargetsIntoView(step);
    coachMark.show(step);
  }

  // While a screen is attached, its own watch steps are checked once per frame.
  function checkWaitEachFrame() {
    if (runner.currentStep()?.screen === attachedScreen.screenId) {
      runner.advanceIfWaitOver(attachedScreen.api.context());
    }
    if (attachedScreen) {
      waitFrameId = requestAnimationFrame(checkWaitEachFrame);
    }
  }

  function findTargetRects(step) {
    return targetSelectorsOf(step).flatMap(selector => {
      const rects = [...document.querySelectorAll(selector)]
        .map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0);
      if (rects.length === 0) {
        warnOnceAboutMissingTarget(step, selector);
      }
      return rects;
    });
  }

  // A missing target means the step text points at nothing: worth a console warning while developing.
  function warnOnceAboutMissingTarget(step, selector) {
    const key = `${step.id}|${selector}`;
    if (!warnedMissingTargets.has(key)) {
      warnedMissingTargets.add(key);
      console.warn(`[tutorial] step "${step.id}": nothing on screen matches ${selector}`);
    }
  }

  async function confirmExit() {
    attachedScreen?.api.onDialogOpen?.();
    const isLeaving = await confirmDialog({
      title: 'Leave the tutorial?',
      body: 'You can start it again from the home screen at any time.',
      confirmLabel: 'Leave tutorial',
      cancelLabel: 'Keep going',
      tone: DIALOG_TONE.DANGER,
    });
    if (isLeaving) {
      finish();
      router.show(mountHomeScreen);
    } else {
      attachedScreen?.api.onDialogClose?.();
    }
  }

  function finish() {
    cancelAnimationFrame(waitFrameId);
    coachMark.destroy();
  }

  return {
    isActive: true,
    gameOptions: scenario.gameOptions,
    createDraftAi: () => new ScriptedDraftAi(scenario.draftScript),
    attach,
    canAct: intent => runner.canAct(intent),
    // Like canAct, but a blocked action also shakes the card, so the player sees where to look.
    allows: intent => {
      const isAllowed = runner.canAct(intent);
      if (!isAllowed) {
        coachMark.shake();
      }
      return isAllowed;
    },
    notify: intent => runner.notify(intent),
    start: () => runner.start(),
    // The player left in another way (e.g. Leave in the game): just clean up.
    end: finish,
  };
}

function targetSelectorsOf(step) {
  return step?.target ? [].concat(step.target) : [];
}

// Targets inside scrolling areas (like the champion grid) are scrolled into view once.
function scrollTargetsIntoView(step) {
  for (const selector of targetSelectorsOf(step)) {
    document.querySelector(selector)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
