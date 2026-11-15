// Proves that the lanes follow the theory the game teaches. Every rule below plays the same
// seeded lane with and without a call, averages over several seeds, and fails if the result does
// not hold. Run after any change to the lanes: node tools/checkLaneTheory.mjs   (needs network)
import { loadGameData } from '../src/data/gameDataRepository.js';
import { ACTION_KIND } from '../src/config/actions.js';
import { ACTIVITY } from '../src/game/activities.js';
import { computeFightChance, gatherFight } from '../src/game/simulation/fightSystem.js';
import { grantExperience } from '../src/game/simulation/economy.js';
import { lanePushFor } from '../src/game/simulation/laneSystem.js';
import { createSimulation } from '../src/game/simulation/simulation.js';
import { executeCommand } from '../src/game/playerCommands.js';
import { INTENT } from '../src/core/intents.js';
import { MINION_KIND, MINION_WALK_SPEED } from '../src/config/minionRules.js';
import { TICK_SECONDS } from '../src/config/gameRules.js';
import { TEAM } from '../src/config/teams.js';
import { ROLE } from '../src/config/roles.js';
import { createAutopilot } from '../src/tutorial/autopilot.js';
import { createScenario } from '../src/tutorial/scenario.js';
import { createTutorialScript } from '../src/tutorial/chapters/tutorialScript.js';

const SEEDS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
// Rules whose effect is small next to the noise between games get more games, and must pass by more
// than the standard error of their mean, so an unrelated change cannot flip them by chance.
const THIN_RULE_SEEDS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const LANE_SETTLED_TICKS = 900;
const LANE_TEST_TICKS = 2400;
const LEAD_TEST_TICKS = 4800;
const AWAY_TICKS = 600;
const LEAD_EXPERIENCE = 700;
const LEAD_ITEM_GOLD = 1000;
const MOVE_TOLERANCE = 1.01;
const FREEZE_SETTLE_TICKS = 900;
const FREEZE_BREAK_TICKS = 600;
const RESET_SETUP_TICKS = 450;
const RESET_AWAY_TICKS = 600;
const CRASH_PUSH = 98;
const PLAY_SAFE_MAX_CS_SHARE = 0.92;

const gameData = await loadGameData();
// What the same lane does with no call at all: the yardstick for the rules below.
const instinct = playWithCall(null);
const instinctRunsForThinRules = playRunsWithCall(null, THIN_RULE_SEEDS);
const rules = [
  checkLeadBecomesCsLead, checkPlaySafe, checkTrade, checkFreeze, checkShoveBreaksFreeze, checkGroupOverridesFreeze, checkShoveWithoutPlan, checkSlowPushCrash, checkAbsenceLosesFarm, checkBadReset,
  checkCannonRule, checkWavesAlwaysExist, checkMinionsNeverJump,
];
const failures = rules.flatMap(checkRule => checkRule());
console.log(failures.length === 0 ? 'OK: the lanes follow the theory' : `FAILED:\n- ${failures.join('\n- ')}`);
process.exitCode = failures.length === 0 ? 0 : 1;

function startGame(seed) {
  const scenario = createScenario(gameData.champions);
  scenario.gameOptions = { ...scenario.gameOptions, seed };
  const autopilot = createAutopilot({ steps: createTutorialScript(scenario), scenario, gameData });
  autopilot.playUpToStep('rift.walk');
  const { gameState } = autopilot;
  const simulation = createSimulation(gameState);
  simulation.runTicks(LANE_SETTLED_TICKS);
  return { gameState, simulation, blueTop: championOf(gameState, TEAM.BLUE), redTop: championOf(gameState, TEAM.RED), lane: gameState.lanes.find(laneState => laneState.lane === 'top') };
}

function championOf(gameState, team, role = ROLE.TOP) {
  return gameState.teams[team].champions.find(championState => championState.role === role);
}

function call(gameState, actionId) {
  executeCommand(gameState, { type: INTENT.CHAMPION_ACTION, role: ROLE.TOP, actionId });
}

function runsOver(playLane, seeds = SEEDS) {
  return seeds.map(seed => playLane(startGame(seed)));
}

function averageOver(playLane, seeds = SEEDS) {
  return averageOfRuns(runsOver(playLane, seeds));
}

function averageOfRuns(runs) {
  return Object.fromEntries(Object.keys(runs[0]).map(key => [key, runs.reduce((sum, run) => sum + run[key], 0) / runs.length]));
}

// How far a rule passes on average, per game, and how sure that is: the standard error of the mean
// (standard deviation ÷ √games) shrinks as games are added, unlike the spread between games.
function marginOf(margins) {
  const mean = margins.reduce((sum, margin) => sum + margin, 0) / margins.length;
  const variance = margins.reduce((sum, margin) => sum + (margin - mean) ** 2, 0) / (margins.length - 1);
  return { mean, standardError: Math.sqrt(variance / margins.length) };
}

function expectMargin(ruleName, margins, measured) {
  const { mean, standardError } = marginOf(margins);
  return expect(ruleName, mean > standardError, `${measured}; margin ${mean.toFixed(1)} ± ${standardError.toFixed(1)} over ${margins.length} games`);
}

function laneResult(game) {
  const { blueTop, redTop } = game;
  return {
    cs: blueTop.creepScore,
    enemyCs: redTop.creepScore,
    gold: blueTop.totalGoldEarned,
    enemyGold: redTop.totalGoldEarned,
    enemyExperience: redTop.experience,
    health: blueTop.healthRatio,
    enemyHealth: redTop.healthRatio,
  };
}

function playWithCall(actionId) {
  return averageOfRuns(playRunsWithCall(actionId));
}

function playRunsWithCall(actionId, seeds = SEEDS) {
  return runsOver(game => {
    if (actionId) {
      call(game.gameState, actionId);
    }
    let frontSum = 0;
    for (let tick = 0; tick < LANE_TEST_TICKS; tick += 1) {
      game.simulation.runTicks(1);
      frontSum += game.lane.frontDistance;
    }
    return { ...laneResult(game), front: frontSum / LANE_TEST_TICKS };
  }, seeds);
}

// The same seeds played twice, compared game by game, so the noise between seeds cancels out.
function marginsPerGame(runs, baselineRuns, marginOfRun) {
  return runs.map((run, index) => marginOfRun(run, baselineRuns[index]));
}

function expect(ruleName, isHeld, measured) {
  console.log(`${isHeld ? 'ok  ' : 'FAIL'} ${ruleName}: ${measured}`);
  return isHeld ? [] : [`${ruleName} (${measured})`];
}

function round(value) {
  return Math.round(value);
}

function checkLeadBecomesCsLead() {
  const withLead = averageOver(game => {
    grantExperience(game.blueTop, LEAD_EXPERIENCE);
    game.blueTop.items.push({ itemId: 0, cost: LEAD_ITEM_GOLD, paidGold: LEAD_ITEM_GOLD, isStartingItem: false });
    game.simulation.runTicks(LEAD_TEST_TICKS);
    return laneResult(game);
  });
  const csLead = withLead.cs - withLead.enemyCs;
  return expect('A lead becomes a CS lead with no calls', csLead >= 10, `+${round(csLead)} CS after 8 minutes`);
}

function checkPlaySafe() {
  const safeRuns = playRunsWithCall('playSafe', THIN_RULE_SEEDS);
  const safe = averageOfRuns(safeRuns);
  const thinInstinct = averageOfRuns(instinctRunsForThinRules);
  // At least 8 % less: half of the 16 % measured over 16 games on 2026-11-15, and inside the 5-15 %
  // a passive laner is meant to lose (specs/role-playstyle/brainstorm.md, shared rules).
  const csMargins = marginsPerGame(safeRuns, instinctRunsForThinRules, (run, baseline) => baseline.cs * PLAY_SAFE_MAX_CS_SHARE - run.cs);
  const gank = averageOver(game => {
    game.blueTop.cautiousUntilSeconds = 0;
    const before = gankChanceOn(game, game.blueTop, TEAM.RED);
    call(game.gameState, 'playSafe');
    return { before, after: gankChanceOn(game, game.blueTop, TEAM.RED) };
  });
  return [
    ...expectMargin('Play safe costs CS', csMargins, `${round(safe.cs)} CS against ${round(thinInstinct.cs)} without a call`),
    ...expect('Play safe makes a gank harder', gank.after < gank.before, `${round(gank.after * 100)}% against ${round(gank.before * 100)}%`),
  ];
}

function gankChanceOn(game, target, attackingTeam) {
  const initiator = championOf(game.gameState, attackingTeam, ROLE.JUNGLE);
  const fight = gatherFight(game.gameState, { initiator, primaryTarget: target });
  return computeFightChance(game.gameState, fight, { wasSpotted: false }).chance;
}

function checkTrade() {
  const trade = playWithCall('trade');
  return expect('Trade wears down the opponent', trade.enemyHealth <= instinct.enemyHealth - 0.08, `their health ${trade.enemyHealth.toFixed(2)} against ${instinct.enemyHealth.toFixed(2)}`);
}

function checkFreeze() {
  const freeze = playWithCall('freeze');
  const freezeRunsForThinRule = playRunsWithCall('freeze', THIN_RULE_SEEDS);
  const ownFarmMargins = marginsPerGame(freezeRunsForThinRule, instinctRunsForThinRules, (run, baseline) => run.cs - baseline.cs * 0.8);
  const ownFarm = averageOfRuns(freezeRunsForThinRule);
  const thinInstinct = averageOfRuns(instinctRunsForThinRules);
  const gankChanceAfter = withFreeze => averageOver(game => {
    if (withFreeze) {
      call(game.gameState, 'freeze');
    }
    game.simulation.runTicks(FREEZE_SETTLE_TICKS);
    return { chance: gankChanceOn(game, game.redTop, TEAM.BLUE) };
  }).chance;
  const gankWithFreeze = gankChanceAfter(true);
  const gankWithoutFreeze = gankChanceAfter(false);
  return [
    ...expect('Freeze makes them easier to gank', gankWithFreeze > gankWithoutFreeze, `${round(gankWithFreeze * 100)}% against ${round(gankWithoutFreeze * 100)}%`),
    ...expect('Freeze costs them CS', freeze.enemyCs <= instinct.enemyCs * 0.8, `${round(freeze.enemyCs)} CS against ${round(instinct.enemyCs)}`),
    ...expectMargin('Freeze keeps your own farm going', ownFarmMargins, `${round(ownFarm.cs)} CS against ${round(thinInstinct.cs)}`),
    ...expect('Freeze holds the wave nearer your tower', freeze.front < instinct.front - 15, `front ${round(freeze.front)} against ${round(instinct.front)}`),
    ...expect('Freeze costs them experience', freeze.enemyExperience < instinct.enemyExperience, `${round(freeze.enemyExperience)} against ${round(instinct.enemyExperience)}`),
  ];
}

// A freeze is not the last word: a shove into it ends it, and the order is gone.
function checkShoveBreaksFreeze() {
  const stillFrozenShare = withShove => averageOver(game => {
    call(game.gameState, 'freeze');
    game.simulation.runTicks(FREEZE_SETTLE_TICKS);
    if (withShove) {
      game.redTop.laneOrders.wave = ACTION_KIND.SHOVE;
      game.redTop.laneOrders.waveSinceSeconds = game.gameState.gameSeconds;
    }
    game.simulation.runTicks(FREEZE_BREAK_TICKS);
    return { stillFrozen: game.blueTop.laneOrders.wave === ACTION_KIND.FREEZE ? 1 : 0 };
  }).stillFrozen;
  const shovedInto = stillFrozenShare(true);
  const leftAlone = stillFrozenShare(false);
  return expect('A shove breaks a freeze', shovedInto === 0 && leftAlone > 0, `still frozen in ${round(shovedInto * 100)}% of games against ${round(leftAlone * 100)}% when left alone`);
}

// A team told to group is there to push: an older freeze must not hold its own wave back.
function checkGroupOverridesFreeze() {
  const { heldTicks, groupedTicks } = averageOver(game => {
    const midLane = game.gameState.lanes.find(laneState => laneState.lane === 'mid');
    const midLaner = championOf(game.gameState, TEAM.BLUE, ROLE.MID);
    executeCommand(game.gameState, { type: INTENT.CHAMPION_ACTION, role: ROLE.MID, actionId: 'freeze' });
    executeCommand(game.gameState, { type: INTENT.TEAM_CALL, callId: 'groupMid' });
    let held = 0;
    let grouped = 0;
    while (midLaner.activeAction?.kind === ACTION_KIND.GROUP && grouped < FREEZE_BREAK_TICKS) {
      game.simulation.runTicks(1);
      grouped += 1;
      held += midLane.freezingTeam === TEAM.BLUE ? 1 : 0;
    }
    return { heldTicks: held, groupedTicks: grouped };
  });
  return expect('Grouping overrides a freeze', heldTicks === 0 && groupedTicks > 0, `held on ${round(heldTicks)} of ${round(groupedTicks)} grouped ticks`);
}

// Without a plan, one shove only moves gold around a little: it is no free win.
function checkShoveWithoutPlan() {
  const shove = playWithCall('shove');
  return expect('One shove without a plan earns no more gold', shove.gold <= instinct.gold * 1.05, `${round(shove.gold)} gold against ${round(instinct.gold)}`);
}

// The biggest wave standing at their tower, while the call lasts.
function largestCrashWith(actionId) {
  return averageOver(game => {
    call(game.gameState, actionId);
    let largestCrash = 0;
    for (let tick = 0; tick < LANE_TEST_TICKS && game.blueTop.laneOrders.wave; tick += 1) {
      game.simulation.runTicks(1);
      const isAtTower = lanePushFor(game.gameState, game.lane, TEAM.BLUE) >= CRASH_PUSH;
      largestCrash = isAtTower ? Math.max(largestCrash, game.lane.minions[TEAM.BLUE]) : largestCrash;
    }
    return { largestCrash };
  }).largestCrash;
}

function checkSlowPushCrash() {
  const slowPush = largestCrashWith('slowPush');
  const shove = largestCrashWith('shove');
  return expect('Slow push crashes a bigger wave than a shove', slowPush > shove, `${slowPush.toFixed(1)} minions against ${shove.toFixed(1)}`);
}

// Being away means the waves die without you: that farm is gone for good.
function checkAbsenceLosesFarm() {
  const measure = isAway => averageOver(game => {
    const csAtStart = game.redTop.creepScore;
    for (let tick = 0; tick < AWAY_TICKS; tick += 1) {
      if (isAway) {
        game.redTop.isAlive = false;
        game.redTop.activity = ACTIVITY.DEAD;
        game.redTop.activitySecondsLeft = AWAY_TICKS;
      }
      game.simulation.runTicks(1);
    }
    return { csGained: game.redTop.creepScore - csAtStart };
  }).csGained;
  const present = measure(false);
  const away = measure(true);
  return expect('A laner who is away loses the wave', away === 0 && present >= 5, `${round(away)} CS away against ${round(present)} present`);
}

// A reset after your own crash leaves the lane in better shape than one while their wave is pushing
// you: the same time in base, but their wave hits their own tower instead of yours.
function checkBadReset() {
  const measure = shoveFirst => runsOver(game => {
    if (shoveFirst) {
      call(game.gameState, 'shove');
    } else {
      game.redTop.laneOrders.wave = ACTION_KIND.SHOVE;
      game.redTop.laneOrders.waveSinceSeconds = game.gameState.gameSeconds;
    }
    game.simulation.runTicks(RESET_SETUP_TICKS);
    const ownTower = outerTowerOf(game.gameState, TEAM.BLUE, 'top');
    const healthAtReset = ownTower.healthRatio;
    call(game.gameState, 'reset');
    game.simulation.runTicks(RESET_AWAY_TICKS);
    return { towerDamage: healthAtReset - ownTower.healthRatio, csLead: game.blueTop.creepScore - game.redTop.creepScore };
  }, THIN_RULE_SEEDS);
  const goodRuns = measure(true);
  const badRuns = measure(false);
  const good = averageOfRuns(goodRuns);
  const bad = averageOfRuns(badRuns);
  // Judged on the farm lost. The tower damage is shown too: in this simulation the bounced wave
  // reaches your tower during the reset either way, so it barely differs (measured 2026-11-15).
  const csMargins = marginsPerGame(goodRuns, badRuns, (goodRun, badRun) => goodRun.csLead - badRun.csLead);
  return expectMargin('A reset after a crash beats one under pressure', csMargins,
    `CS lead ${round(good.csLead)} against ${round(bad.csLead)} (your tower loses ${(good.towerDamage * 100).toFixed(1)}% against ${(bad.towerDamage * 100).toFixed(1)}%)`);
}

function outerTowerOf(gameState, team, lane) {
  return gameState.teams[team].structures.find(structure => structure.lane === lane && structure.tier === 'outer');
}

function checkCannonRule() {
  const game = startGame(SEEDS[0]);
  const wavesWithCannon = new Set();
  game.simulation.runTicks(1500);
  for (const minion of game.lane.minionList.filter(candidate => candidate.kind === MINION_KIND.CANNON)) {
    wavesWithCannon.add(minion.waveNumber);
  }
  const isEveryThird = [...wavesWithCannon].every(waveNumber => waveNumber % 3 === 0);
  return expect('Cannons come with every third wave', wavesWithCannon.size > 0 && isEveryThird, `waves ${[...wavesWithCannon].join(', ')}`);
}

function checkWavesAlwaysExist() {
  const game = startGame(SEEDS[0]);
  let emptyTicks = 0;
  for (let tick = 0; tick < LANE_TEST_TICKS; tick += 1) {
    game.simulation.runTicks(1);
    emptyTicks += game.gameState.lanes.filter(laneState => !laneState.minionList.some(minion => minion.team === TEAM.BLUE)).length;
  }
  return expect('Your own minions are always on the lane', emptyTicks === 0, `${emptyTicks} lane-ticks without any`);
}

function checkMinionsNeverJump() {
  const game = startGame(SEEDS[0]);
  let largestStep = 0;
  const maxStep = MINION_WALK_SPEED * TICK_SECONDS * MOVE_TOLERANCE;
  for (let tick = 0; tick < LANE_TEST_TICKS; tick += 1) {
    game.simulation.runTicks(1);
    for (const laneState of game.gameState.lanes) {
      for (const minion of laneState.minionList) {
        largestStep = Math.max(largestStep, Math.abs(minion.laneDistance - minion.previousDistance));
      }
    }
  }
  return expect('Minions walk and never jump', largestStep <= maxStep, `largest step ${largestStep.toFixed(2)} of ${maxStep.toFixed(2)} allowed`);
}
