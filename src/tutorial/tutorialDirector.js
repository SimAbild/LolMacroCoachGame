import { STORAGE_KEY, writeFlag } from '../core/storage.js';
import { DIALOG_TONE, confirmDialog } from '../ui/dialog.js';
import { rectFrom } from '../ui/geometry.js';
import { ScriptedDraftAi } from '../draft/scriptedDraftAi.js';
import { mountHomeScreen } from '../screens/homeScreen.js';
import { STEP_KIND, createTutorialRunner } from './tutorialRunner.js';
import { createCoachMark } from './ui/coachMark.js';

const MISSING_TARGET_GRACE_FRAMES = 30;

// Connects the tutorial steps to the screens. The draft, game and end screens receive this
// object as `tutorial` and call attach / allows / notify; a normal game gets NO_TUTORIAL instead.
// A screen attaches with an api: { context() } plus optional hooks:
//   onStepShown(step)             e.g. the game holds still for dialogs
//   checksWaitsEachTick           the game ends watch steps itself, on the exact tick (see isWaitOver)
//   fastForwardTo(seconds), afterSkip()   for skip steps
//   worldToClient(point)          for map targets
//   onDialogOpen(), onDialogClose()       so a running game pauses while "Back to home" asks
//   onCallRefused()               the game runs again until the refused call can succeed
export function createTutorialDirector({ router, steps, scenario }) {
  const coachMark = createCoachMark({ findTargetRects, onNext: () => runner.next(), onExit: confirmExit });
  const runner = createTutorialRunner(steps, { onStepEntered: showStepIfOnScreen, onFinished: completeTutorial });
  const missingTargetFrames = new Map();
  const startedStepIds = new Set();
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
    if (!isOnAttachedScreen(step)) {
      coachMark.hide();
      return;
    }
    startStepOnce(step);
    attachedScreen.api.onStepShown?.(step);
    scrollTargetsIntoView(step);
    coachMark.show(step);
    if (step.kind === STEP_KIND.SKIP) {
      skipAhead(step);
    }
  }

  function isOnAttachedScreen(step) {
    return Boolean(step) && step.screen === attachedScreen?.screenId;
  }

  // onEnter sets up a step (e.g. starts its deadline) and must run once, even if the screen re-attaches.
  function startStepOnce(step) {
    if (!startedStepIds.has(step.id)) {
      startedStepIds.add(step.id);
      step.onEnter?.(attachedScreen.api.context());
    }
  }

  async function skipAhead(step) {
    const { api } = attachedScreen;
    await api.fastForwardTo(step.toSeconds);
    if (runner.currentStep() === step && attachedScreen?.api === api) {
      step.patch?.(api.context());
      api.afterSkip?.();
      runner.advance();
    }
  }

  // Screens without a simulation (the draft) have their watch steps checked once per frame.
  function checkWaitEachFrame() {
    const step = runner.currentStep();
    if (isOnAttachedScreen(step) && !attachedScreen.api.checksWaitsEachTick) {
      runner.advanceIfWaitOver(attachedScreen.api.context());
    }
    if (attachedScreen) {
      waitFrameId = requestAnimationFrame(checkWaitEachFrame);
    }
  }

  function findTargetRects(step) {
    return targetsOf(step).flatMap(target => (typeof target === 'string' ? findElementRects(step, target) : mapPointRects(target)));
  }

  function findElementRects(step, selector) {
    const rects = elementRects(selector);
    if (rects.length === 0) {
      warnOnceAboutMissingTarget(step, selector);
    }
    return rects;
  }

  // Empty only while the map is still loading. The coach mark looks again every frame,
  // so the hole appears by itself once the map is there.
  function mapPointRects({ mapPoint, radius }) {
    const center = attachedScreen?.api.worldToClient?.(mapPoint);
    if (!center) {
      return [];
    }
    const size = radius * center.scale;
    return [rectFrom({ left: center.x - size, top: center.y - size, width: size * 2, height: size * 2 })];
  }

  // A target that stays missing means the step points at nothing: worth a console warning while
  // developing. Being absent for a moment is normal, as the panels update just after a command.
  function warnOnceAboutMissingTarget(step, selector) {
    const key = `${step.id}|${selector}`;
    const framesMissing = (missingTargetFrames.get(key) ?? 0) + 1;
    missingTargetFrames.set(key, framesMissing);
    if (framesMissing === MISSING_TARGET_GRACE_FRAMES) {
      console.warn(`[tutorial] step "${step.id}": nothing on screen matches ${selector}`);
    }
  }

  async function confirmExit() {
    attachedScreen?.api.onDialogOpen?.();
    const isLeaving = await confirmDialog({
      title: 'Leave the tutorial?',
      body: 'You can start it again from the home screen at any time.',
      confirmLabel: 'Back to home',
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

  // The last step was finished. Leaving early (finish alone) does not count as completing it.
  function completeTutorial() {
    writeFlag(STORAGE_KEY.TUTORIAL_COMPLETED);
    finish();
  }

  function finish() {
    cancelAnimationFrame(waitFrameId);
    coachMark.destroy();
  }

  // Like canAct, but a blocked action also shakes the card, so the player sees where to look.
  function allows(intent) {
    const isAllowed = runner.canAct(intent);
    if (!isAllowed) {
      coachMark.shake();
    }
    return isAllowed;
  }

  return {
    isActive: true,
    gameOptions: scenario.gameOptions,
    createDraftAi: () => new ScriptedDraftAi(scenario.draftScript),
    attach,
    canAct: intent => runner.canAct(intent),
    allows,
    notify: intent => runner.notify(intent),
    // A refused call (everyone is dead, say) can only succeed later. If the game stayed on hold,
    // that "later" would never come and the player would be stuck on a step needing that call.
    notifyRefused: () => attachedScreen?.api.onCallRefused?.(),
    // The game asks after every tick whether to halt, so a watch step ends on the exact tick.
    isWaitOver: context => isOnAttachedScreen(runner.currentStep()) && runner.isWaitOver(context),
    advanceAfterWait: context => runner.advanceIfWaitOver(context),
    start: () => runner.start(),
    startAt: stepId => runner.goTo(stepId),
    // The player left in another way (e.g. Leave in the game): just clean up.
    end: finish,
  };
}

function targetsOf(step) {
  return step?.target ? [].concat(step.target) : [];
}

function elementRects(selector) {
  return [...document.querySelectorAll(selector)]
    .map(element => element.getBoundingClientRect())
    .filter(rect => rect.width > 0 && rect.height > 0);
}

// Targets inside scrolling areas (like the champion grid) are scrolled into view once.
function scrollTargetsIntoView(step) {
  for (const selector of targetsOf(step).filter(target => typeof target === 'string')) {
    document.querySelector(selector)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
