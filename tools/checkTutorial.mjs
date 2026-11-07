// Plays the guided tutorial headless with the same steps, runner and commands as the browser,
// giving every expected action itself, and checks that it plays out the way the text promises.
// Run: node tools/checkTutorial.mjs [--draft-only] [--twice]   (needs network for Data Dragon)
//   --draft-only  stop after the draft and swap chapters
//   --twice       play it twice and check that both runs are identical (determinism)
import { loadGameData } from '../src/data/gameDataRepository.js';
import { DraftState } from '../src/draft/draftState.js';
import { ScriptedDraftAi } from '../src/draft/scriptedDraftAi.js';
import { applyLoadoutIntent, createDraftLoadouts } from '../src/draft/teamLoadout.js';
import { createInitialGameState } from '../src/game/gameState.js';
import { createSimulation } from '../src/game/simulation/simulation.js';
import { executeCommand } from '../src/game/playerCommands.js';
import { TICKS_PER_GAME_SECOND } from '../src/config/gameRules.js';
import { INTENT } from '../src/core/intents.js';
import { ROLE } from '../src/config/roles.js';
import { BUILD_TYPE } from '../src/config/buildTypes.js';
import { TEAM, opposingTeam } from '../src/config/teams.js';
import { formatGameTime } from '../src/ui/formatGameTime.js';
import { TUTORIAL_SIDE, createScenario, scriptEntryFor } from '../src/tutorial/scenario.js';
import { createTutorialScript } from '../src/tutorial/chapters/tutorialScript.js';
import { STEP_KIND, createTutorialRunner } from '../src/tutorial/tutorialRunner.js';
import { hasWard } from '../src/tutorial/predicates.js';

const MAX_STEP_VISITS = 1000;
const MAX_WAIT_TICKS = 10 * 60 * TICKS_PER_GAME_SECOND;
const AI_TEAM = opposingTeam(TUTORIAL_SIDE);
const isDraftOnly = process.argv.includes('--draft-only');
// Branches the lessons are built for. Taking another one is not wrong in the browser (the text
// covers it), but here it means the setup no longer produces the intended situation.
const EXPECTED_STEPS = Object.freeze(['gank.success', 'dragon.taken']);
const CHECKS_WHEN_WAIT_ENDS = Object.freeze({
  'dragon.wardWatch': { holds: context => hasWard(context, TEAM.BLUE), problem: 'Leona did not place the dragon ward in time' },
});

const gameData = await loadGameData();
const scenario = createScenario(gameData.champions);
reportFallbacks(scenario.draftScript);
const firstRun = playTutorial();
const problems = [...firstRun.problems];
if (process.argv.includes('--twice')) {
  const secondRun = playTutorial();
  problems.push(...compareRuns(firstRun, secondRun));
}
console.log(problems.length === 0 ? 'OK: the tutorial plays through as written' : `FAILED:\n- ${problems.join('\n- ')}`);
process.exitCode = problems.length === 0 ? 0 : 1;

function playTutorial() {
  const run = createRun();
  run.runner.start();
  for (let visits = 0; visits < MAX_STEP_VISITS; visits += 1) {
    const step = run.runner.currentStep();
    if (!step || step.kind === STEP_KIND.FREE || (isDraftOnly && step.screen !== 'draft')) {
      return finishRun(run);
    }
    playStep(run, step);
  }
  run.problems.push(`stuck at step "${run.runner.currentStep()?.id}"`);
  return finishRun(run);
}

function createRun() {
  const run = {
    draftState: new DraftState(gameData.champions),
    draftAi: new ScriptedDraftAi(scenario.draftScript),
    loadouts: null,
    game: null,
    trace: [],
    problems: [],
  };
  run.runner = createTutorialRunner(createTutorialScript(scenario), {
    onStepEntered: step => enterStep(run, step),
    onFinished: () => {},
  });
  return run;
}

// Logs the step and, in the game, runs its onEnter, just as the director does when it shows it.
function enterStep(run, step) {
  if (step.screen === 'game') {
    run.game ??= startGame(run);
    step.onEnter?.(contextOf(run));
  }
  const time = run.game ? `tick ${run.game.gameState.tickCount} | ${formatGameTime(run.game.gameState.gameSeconds)}` : 'draft';
  const line = `${step.id.padEnd(20)} | ${step.kind.padEnd(6)} | ${time}`;
  run.trace.push(line);
  console.log(line);
}

function startGame(run) {
  const gameState = createInitialGameState({ loadouts: run.loadouts, playerSide: TUTORIAL_SIDE, itemCatalog: gameData.items, ...scenario.gameOptions });
  const simulation = createSimulation(gameState, { shouldHalt: state => run.runner.isWaitOver({ gameState: state }) });
  return { gameState, simulation };
}

function contextOf(run) {
  return run.game ? { gameState: run.game.gameState } : { draftState: run.draftState, loadouts: run.loadouts };
}

function playStep(run, step) {
  const playByKind = {
    [STEP_KIND.DIALOG]: () => run.runner.next(),
    [STEP_KIND.DO]: () => giveExpectedAction(run, step),
    [STEP_KIND.WATCH]: () => (step.screen === 'game' ? waitInGame(run, step) : waitInDraft(run)),
    [STEP_KIND.SKIP]: () => skipAhead(run, step),
  };
  playByKind[step.kind]();
}

function giveExpectedAction(run, step) {
  if (!run.runner.canAct(step.expect)) {
    run.problems.push(`step "${step.id}" does not allow its own expected action`);
  }
  if (step.screen === 'game') {
    const commandResult = executeCommand(run.game.gameState, step.expect);
    if (!commandResult.isIssued) {
      run.problems.push(`step "${step.id}": the call was refused (${commandResult.reason})`);
    }
  } else {
    applyDraftIntent(run, step.expect);
  }
  run.runner.notify(step.expect);
}

// The same changes the draft screen makes for these intents.
function applyDraftIntent(run, intent) {
  if (intent.type === INTENT.DRAFT_LOCK) {
    run.draftState.lockIn(intent.championId);
    enterSwapPhaseWhenDraftIsDone(run);
  } else if (intent.type !== INTENT.START_GAME) {
    run.loadouts[TUTORIAL_SIDE] = applyLoadoutIntent(run.loadouts[TUTORIAL_SIDE], intent);
  }
}

function waitInDraft(run) {
  const { draftState, draftAi } = run;
  if (!draftState.isComplete && draftState.currentStep.team === AI_TEAM) {
    draftState.lockIn(draftAi.chooseChampion(draftState).id);
    enterSwapPhaseWhenDraftIsDone(run);
  }
  run.runner.advanceIfWaitOver(contextOf(run));
}

function enterSwapPhaseWhenDraftIsDone(run) {
  if (run.draftState.isComplete && !run.loadouts) {
    run.loadouts = createDraftLoadouts(run.draftState, { playerSide: TUTORIAL_SIDE, aiTeam: AI_TEAM, aiRoleByChampionId: run.draftAi.roleByChampionId });
  }
}

// Like the browser: the simulation runs until it halts on the tick the step's condition comes true.
function waitInGame(run, step) {
  run.game.simulation.runTicks(MAX_WAIT_TICKS);
  const context = contextOf(run);
  if (!run.runner.isWaitOver(context)) {
    run.problems.push(`step "${step.id}": waited ${MAX_WAIT_TICKS} ticks and it never ended`);
    run.runner.advance();
    return;
  }
  const check = CHECKS_WHEN_WAIT_ENDS[step.id];
  if (check && !check.holds(context)) {
    run.problems.push(check.problem);
  }
  run.runner.advanceIfWaitOver(context);
}

// Like fastForward in the browser, but all at once: the same ticks, so the same result.
function skipAhead(run, step) {
  const { gameState, simulation } = run.game;
  simulation.runTicks(Math.round(step.toSeconds * TICKS_PER_GAME_SECOND) - gameState.tickCount);
  step.patch?.(contextOf(run));
  run.runner.advance();
}

function finishRun(run) {
  if (!isDraftOnly) {
    const visited = run.trace.map(line => line.split(' ')[0]);
    run.problems.push(...EXPECTED_STEPS.filter(stepId => !visited.includes(stepId)).map(stepId => `never reached "${stepId}"`));
  }
  run.problems.push(...checkLoadouts(run));
  return run;
}

// What the swap chapter promises: Malphite top, Volibear a tank in the jungle, Leona with Exhaust,
// and Red's champions in the roles the script gives them.
function checkLoadouts(run) {
  if (!run.loadouts) {
    return ['the draft never finished'];
  }
  const nameOf = name => scriptEntryFor(scenario.draftScript, name).champion.name;
  const blue = byRole(run.loadouts[TUTORIAL_SIDE]);
  const red = byRole(run.loadouts[AI_TEAM]);
  return [
    expectEqual('blue top', blue[ROLE.TOP].champion.name, nameOf('Malphite')),
    expectEqual('blue jungle', blue[ROLE.JUNGLE].champion.name, nameOf('Volibear')),
    expectEqual('blue jungle build', blue[ROLE.JUNGLE].buildType, BUILD_TYPE.TANK),
    expectEqual('blue support spells', blue[ROLE.SUPPORT].summonerSpells.join('+'), 'flash+exhaust'),
    ...scenario.draftScript.filter(entry => entry.team === AI_TEAM && entry.role)
      .map(entry => expectEqual(`red ${entry.role}`, red[entry.role].champion.name, entry.champion.name)),
  ].filter(Boolean);
}

function compareRuns(firstRun, secondRun) {
  const firstTrace = firstRun.trace.join('\n');
  const isSame = firstTrace === secondRun.trace.join('\n');
  console.log(isSame ? 'SAME: both runs took the same steps on the same ticks' : 'DIFFERENT: the two runs diverged');
  return isSame ? [] : ['two runs of the tutorial were not identical'];
}

function byRole(loadout) {
  return Object.fromEntries(loadout.map(entry => [entry.role, entry]));
}

function expectEqual(label, actual, expected) {
  return actual === expected ? null : `${label}: expected ${expected}, got ${actual}`;
}

function reportFallbacks(draftScript) {
  for (const entry of draftScript.filter(candidate => candidate.isFallback)) {
    console.warn(`WARNING: ${entry.name} is not on patch ${gameData.version}; the tutorial uses ${entry.champion.name} instead`);
  }
}
