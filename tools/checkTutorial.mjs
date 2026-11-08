// Plays the guided tutorial headless with the same steps, runner and commands as the browser,
// giving every expected action itself, and checks that it plays out the way the text promises.
// Run: node tools/checkTutorial.mjs [--draft-only] [--twice]   (needs network for Data Dragon)
//   --draft-only  stop after the draft and swap chapters
//   --twice       play it twice and check that both runs are identical (determinism)
import { loadGameData } from '../src/data/gameDataRepository.js';
import { ROLE } from '../src/config/roles.js';
import { BUILD_TYPE } from '../src/config/buildTypes.js';
import { TEAM, opposingTeam } from '../src/config/teams.js';
import { formatGameTime } from '../src/ui/formatGameTime.js';
import { createAutopilot } from '../src/tutorial/autopilot.js';
import { TUTORIAL_SIDE, createScenario, scriptEntryFor } from '../src/tutorial/scenario.js';
import { isBaronWarded } from '../src/tutorial/chapters/baronChapter.js';
import { createTutorialScript } from '../src/tutorial/chapters/tutorialScript.js';
import { hasWard } from '../src/tutorial/predicates.js';

const AI_TEAM = opposingTeam(TUTORIAL_SIDE);
const isDraftOnly = process.argv.includes('--draft-only');
// Branches the lessons are built for. Taking another one is not wrong in the browser (the text
// covers it), but here it means the setup no longer produces the intended situation.
const EXPECTED_STEPS = Object.freeze([
  'gank.success', 'wave.freezeResult', 'dragon.taken', 'plates.broke', 'plates.reset', 'herald.taken', 'baron.fight', 'baron.taken', 'siege.inhibitor', 'end.victory',
]);
const CHECKS_WHEN_WAIT_ENDS = Object.freeze({
  'dragon.wardWatch': { holds: context => hasWard(context, TEAM.BLUE), problem: 'Leona did not place the dragon ward in time' },
  'baron.wardWatch': { holds: isBaronWarded, problem: 'Leona did not place the Baron ward in time' },
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
  const run = { trace: [], problems: [] };
  const autopilot = createAutopilot({
    steps: createTutorialScript(scenario),
    scenario,
    gameData,
    onStepEntered: (step, context) => traceStep(run, step, context),
    onWaitEnded: (step, context) => checkWait(run, step, context),
    onProblem: problem => run.problems.push(problem),
  });
  autopilot.start();
  autopilot.playUntil(step => isDraftOnly && step.screen !== 'draft');
  run.problems.push(...checkOutcome(run, autopilot));
  return run;
}

function traceStep(run, step, { gameState }) {
  const time = gameState ? `tick ${gameState.tickCount} | ${formatGameTime(gameState.gameSeconds)}` : 'draft';
  const line = `${step.id.padEnd(20)} | ${step.kind.padEnd(6)} | ${time}`;
  run.trace.push(line);
  console.log(line);
}

function checkWait(run, step, context) {
  const check = CHECKS_WHEN_WAIT_ENDS[step.id];
  if (check && !check.holds(context)) {
    run.problems.push(check.problem);
  }
}

function checkOutcome(run, autopilot) {
  if (isDraftOnly) {
    return checkLoadouts(autopilot.loadouts);
  }
  const visited = run.trace.map(line => line.split(' ')[0]);
  return [
    ...EXPECTED_STEPS.filter(stepId => !visited.includes(stepId)).map(stepId => `never reached "${stepId}"`),
    ...checkLoadouts(autopilot.loadouts),
    expectEqual('winner', autopilot.gameState?.winner, TUTORIAL_SIDE),
  ].filter(Boolean);
}

// What the swap chapter promises: Malphite top, Volibear a tank in the jungle, Leona with Exhaust,
// and Red's champions in the roles the script gives them.
function checkLoadouts(loadouts) {
  if (!loadouts) {
    return ['the draft never finished'];
  }
  const nameOf = name => scriptEntryFor(scenario.draftScript, name).champion.name;
  const blue = byRole(loadouts[TUTORIAL_SIDE]);
  const red = byRole(loadouts[AI_TEAM]);
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
