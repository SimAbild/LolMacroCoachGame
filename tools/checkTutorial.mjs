// Plays the guided tutorial headless with the same steps and runner as the browser, giving every
// expected action itself, and checks that it reaches the end with the result the text promises.
// Run: node tools/checkTutorial.mjs --draft-only   (needs network for Data Dragon)
import { loadGameData } from '../src/data/gameDataRepository.js';
import { DraftState } from '../src/draft/draftState.js';
import { ScriptedDraftAi } from '../src/draft/scriptedDraftAi.js';
import { applyLoadoutIntent, createDraftLoadouts } from '../src/draft/teamLoadout.js';
import { INTENT } from '../src/core/intents.js';
import { ROLE } from '../src/config/roles.js';
import { BUILD_TYPE } from '../src/config/buildTypes.js';
import { opposingTeam } from '../src/config/teams.js';
import { TUTORIAL_SIDE, createScenario, scriptEntryFor } from '../src/tutorial/scenario.js';
import { createTutorialScript } from '../src/tutorial/chapters/tutorialScript.js';
import { STEP_KIND, createTutorialRunner } from '../src/tutorial/tutorialRunner.js';

const MAX_STEP_VISITS = 500;
const AI_TEAM = opposingTeam(TUTORIAL_SIDE);

const gameData = await loadGameData();
const scenario = createScenario(gameData.champions);
reportFallbacks(scenario.draftScript);
const draft = { draftState: new DraftState(gameData.champions), ai: new ScriptedDraftAi(scenario.draftScript), loadouts: null };
const problems = [];
const runner = createTutorialRunner(createTutorialScript(scenario), {
  onStepEntered: step => console.log(`${step.id.padEnd(22)} | ${step.kind}`),
  onFinished: () => console.log('(end of tutorial)'),
});

runner.start();
playDraftAndSwap();
problems.push(...checkLoadouts());
console.log(problems.length === 0 ? 'OK: the draft and swap chapters play through as written' : `FAILED:\n- ${problems.join('\n- ')}`);
process.exitCode = problems.length === 0 ? 0 : 1;

function playDraftAndSwap() {
  for (let visits = 0; visits < MAX_STEP_VISITS; visits += 1) {
    const step = runner.currentStep();
    if (!step || step.screen !== 'draft') {
      return;
    }
    playStep(step);
  }
  problems.push(`stuck at step "${runner.currentStep()?.id}"`);
}

function playStep(step) {
  if (step.kind === STEP_KIND.DIALOG) {
    runner.next();
  } else if (step.kind === STEP_KIND.DO) {
    giveExpectedAction(step);
  } else if (step.kind === STEP_KIND.WATCH) {
    takeOpponentTurn();
    runner.advanceIfWaitOver({ draftState: draft.draftState, loadouts: draft.loadouts });
  }
}

function giveExpectedAction(step) {
  if (!runner.canAct(step.expect)) {
    problems.push(`step "${step.id}" does not allow its own expected action`);
  }
  applyDraftIntent(step.expect);
  runner.notify(step.expect);
}

// The same changes the draft screen makes for these intents.
function applyDraftIntent(intent) {
  if (intent.type === INTENT.DRAFT_LOCK) {
    draft.draftState.lockIn(intent.championId);
    enterSwapPhaseWhenDraftIsDone();
  } else if (intent.type !== INTENT.START_GAME) {
    draft.loadouts[TUTORIAL_SIDE] = applyLoadoutIntent(draft.loadouts[TUTORIAL_SIDE], intent);
  }
}

function takeOpponentTurn() {
  const { draftState } = draft;
  if (!draftState.isComplete && draftState.currentStep.team === AI_TEAM) {
    draftState.lockIn(draft.ai.chooseChampion(draftState).id);
    enterSwapPhaseWhenDraftIsDone();
  }
}

function enterSwapPhaseWhenDraftIsDone() {
  if (draft.draftState.isComplete && !draft.loadouts) {
    draft.loadouts = createDraftLoadouts(draft.draftState, { playerSide: TUTORIAL_SIDE, aiTeam: AI_TEAM, aiRoleByChampionId: draft.ai.roleByChampionId });
  }
}

// What the chapters promise: Malphite top, Volibear a tank in the jungle, Leona with Exhaust,
// and Red's champions in the roles the script gives them.
function checkLoadouts() {
  if (!draft.loadouts) {
    return ['the draft never finished'];
  }
  const nameOf = name => scriptEntryFor(scenario.draftScript, name).champion.name;
  const blue = byRole(draft.loadouts[TUTORIAL_SIDE]);
  const red = byRole(draft.loadouts[AI_TEAM]);
  return [
    expectEqual('blue top', blue[ROLE.TOP].champion.name, nameOf('Malphite')),
    expectEqual('blue jungle', blue[ROLE.JUNGLE].champion.name, nameOf('Volibear')),
    expectEqual('blue jungle build', blue[ROLE.JUNGLE].buildType, BUILD_TYPE.TANK),
    expectEqual('blue support spells', blue[ROLE.SUPPORT].summonerSpells.join('+'), 'flash+exhaust'),
    ...scenario.draftScript.filter(entry => entry.team === AI_TEAM && entry.role)
      .map(entry => expectEqual(`red ${entry.role}`, red[entry.role].champion.name, entry.champion.name)),
  ].filter(Boolean);
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
