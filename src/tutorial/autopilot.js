import { TICKS_PER_GAME_SECOND } from '../config/gameRules.js';
import { opposingTeam } from '../config/teams.js';
import { INTENT } from '../core/intents.js';
import { DraftState } from '../draft/draftState.js';
import { ScriptedDraftAi } from '../draft/scriptedDraftAi.js';
import { applyLoadoutIntent, createDraftLoadouts } from '../draft/teamLoadout.js';
import { createInitialGameState } from '../game/gameState.js';
import { executeCommand } from '../game/playerCommands.js';
import { createSimulation } from '../game/simulation/simulation.js';
import { TUTORIAL_SIDE } from './scenario.js';
import { STEP_KIND, createTutorialRunner } from './tutorialRunner.js';

const MAX_STEP_VISITS = 1000;
const MAX_WAIT_TICKS = 10 * 60 * TICKS_PER_GAME_SECOND;
const RETRY_INTERVAL_TICKS = TICKS_PER_GAME_SECOND;
const FREE_PLAY_CALL_INTERVAL_TICKS = 10 * TICKS_PER_GAME_SECOND;
const MAX_FREE_PLAY_TICKS = 30 * 60 * TICKS_PER_GAME_SECOND;
const AI_TEAM = opposingTeam(TUTORIAL_SIDE);

// Plays the tutorial without a screen: it reads every dialog, gives every expected action and
// waits out every watch step, using the same steps, runner and commands as the browser.
// tools/checkTutorial.mjs checks the result; the ?tutorial&from= jump starts from it.
// onStepEntered(step, context), onWaitEnded(step, context) and onProblem(text) let the checker follow along.
export function createAutopilot({ steps, scenario, gameData, onStepEntered = () => {}, onWaitEnded = () => {}, onProblem = () => {} }) {
  const draftState = new DraftState(gameData.champions);
  const draftAi = new ScriptedDraftAi(scenario.draftScript);
  const session = { loadouts: null, gameState: null, simulation: null, stopAtStepId: null };
  const runner = createTutorialRunner(steps, { onStepEntered: enterStep, onFinished: () => {} });
  const playByKind = {
    [STEP_KIND.DIALOG]: () => runner.next(),
    [STEP_KIND.DO]: giveExpectedAction,
    [STEP_KIND.WATCH]: step => (step.screen === 'game' ? waitInGame(step) : waitInDraft()),
    [STEP_KIND.SKIP]: skipAhead,
    [STEP_KIND.FREE]: playFreely,
  };

  function contextOf() {
    return session.gameState ? { gameState: session.gameState } : { draftState, loadouts: session.loadouts };
  }

  // The step it stops at is left for whoever takes over, so its onEnter must not run here.
  function enterStep(step) {
    if (step.id === session.stopAtStepId) {
      return;
    }
    if (step.screen === 'game') {
      startGameOnce();
      step.onEnter?.(contextOf());
    }
    onStepEntered(step, contextOf());
  }

  function startGameOnce() {
    if (session.gameState) {
      return;
    }
    session.gameState = createInitialGameState({ loadouts: session.loadouts, playerSide: TUTORIAL_SIDE, itemCatalog: gameData.items, ...scenario.gameOptions });
    session.simulation = createSimulation(session.gameState, { shouldHalt: state => runner.isWaitOver({ gameState: state }) });
  }

  function giveExpectedAction(step) {
    if (!runner.canAct(step.expect)) {
      onProblem(`step "${step.id}" does not allow its own expected action`);
    }
    if (step.screen === 'game') {
      issueCall(step);
    } else {
      applyDraftIntent(step.expect);
    }
    runner.notify(step.expect);
  }

  // Like the browser: a refused call lets the game run on, and the player tries again.
  function issueCall(step) {
    const firstResult = executeCommand(session.gameState, step.expect);
    if (firstResult.isIssued) {
      return;
    }
    onProblem(`step "${step.id}": the call was refused (${firstResult.reason})`);
    let isIssued = false;
    for (let ticksWaited = 0; !isIssued && ticksWaited < MAX_WAIT_TICKS; ticksWaited += RETRY_INTERVAL_TICKS) {
      session.simulation.runTicks(RETRY_INTERVAL_TICKS);
      isIssued = executeCommand(session.gameState, step.expect).isIssued;
    }
  }

  // The same changes the draft screen makes for these intents.
  function applyDraftIntent(intent) {
    if (intent.type === INTENT.DRAFT_LOCK) {
      draftState.lockIn(intent.championId);
      enterSwapPhaseWhenDraftIsDone();
    } else if (intent.type !== INTENT.START_GAME) {
      session.loadouts[TUTORIAL_SIDE] = applyLoadoutIntent(session.loadouts[TUTORIAL_SIDE], intent);
    }
  }

  function waitInDraft() {
    if (!draftState.isComplete && draftState.currentStep.team === AI_TEAM) {
      draftState.lockIn(draftAi.chooseChampion(draftState).id);
      enterSwapPhaseWhenDraftIsDone();
    }
    runner.advanceIfWaitOver(contextOf());
  }

  function enterSwapPhaseWhenDraftIsDone() {
    if (draftState.isComplete && !session.loadouts) {
      session.loadouts = createDraftLoadouts(draftState, { playerSide: TUTORIAL_SIDE, aiTeam: AI_TEAM, aiRoleByChampionId: draftAi.roleByChampionId });
    }
  }

  // Like the browser: the simulation runs until it halts on the tick the step's condition comes true.
  function waitInGame(step) {
    session.simulation.runTicks(MAX_WAIT_TICKS);
    finishWait(step, MAX_WAIT_TICKS);
  }

  // A player in free play keeps giving calls; the step says which one the autopilot repeats.
  // A refused call (everyone is dead) needs no handling: it is simply given again next time.
  function playFreely(step) {
    let ticksPlayed = 0;
    while (ticksPlayed < MAX_FREE_PLAY_TICKS && !runner.isWaitOver(contextOf())) {
      executeCommand(session.gameState, step.autopilotCall);
      ticksPlayed += session.simulation.runTicks(FREE_PLAY_CALL_INTERVAL_TICKS);
    }
    finishWait(step, ticksPlayed);
  }

  function finishWait(step, ticksWaited) {
    if (runner.isWaitOver(contextOf())) {
      onWaitEnded(step, contextOf());
      runner.advanceIfWaitOver(contextOf());
    } else {
      onProblem(`step "${step.id}": waited ${ticksWaited} ticks and it never ended`);
      runner.advance(typeof step.next === 'function' ? null : step.next);
    }
  }

  // Like fastForward in the browser, but all at once: the same ticks, so the same result.
  function skipAhead(step) {
    const { gameState, simulation } = session;
    simulation.runTicks(Math.round(step.toSeconds * TICKS_PER_GAME_SECOND) - gameState.tickCount);
    step.patch?.(contextOf());
    runner.advance();
  }

  // Plays until the tutorial reaches `stopWhen(step)`, or to its end when nothing stops it.
  function playUntil(stopWhen) {
    for (let visits = 0; visits < MAX_STEP_VISITS; visits += 1) {
      const step = runner.currentStep();
      if (!step || stopWhen(step)) {
        return;
      }
      playByKind[step.kind](step);
    }
    onProblem(`stuck at step "${runner.currentStep()?.id}"`);
  }

  return {
    start: () => runner.start(),
    playUntil,
    // Stops just before `stepId` starts, so the browser's director can start it instead.
    playUpToStep: stepId => {
      session.stopAtStepId = stepId;
      runner.start();
      playUntil(step => step.id === stepId);
    },
    get loadouts() {
      return session.loadouts;
    },
    get gameState() {
      return session.gameState;
    },
  };
}
