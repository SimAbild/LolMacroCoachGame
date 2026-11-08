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

const gameData = await loadGameData();
// What the same lane does with no call at all: the yardstick for the rules below.
const instinct = playWithCall(null);
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

function averageOver(playLane) {
  const runs = SEEDS.map(seed => playLane(startGame(seed)));
  return Object.fromEntries(Object.keys(runs[0]).map(key => [key, runs.reduce((sum, run) => sum + run[key], 0) / runs.length]));
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
  return averageOver(game => {
    if (actionId) {
      call(game.gameState, actionId);
    }
    let frontSum = 0;
    for (let tick = 0; tick < LANE_TEST_TICKS; tick += 1) {
      game.simulation.runTicks(1);
      frontSum += game.lane.frontDistance;
    }
    return { ...laneResult(game), front: frontSum / LANE_TEST_TICKS };
  });
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
  const safe = playWithCall('playSafe');
  const gank = averageOver(game => {
    game.blueTop.cautiousUntilSeconds = 0;
    const before = gankChanceOn(game, game.blueTop, TEAM.RED);
    call(game.gameState, 'playSafe');
    return { before, after: gankChanceOn(game, game.blueTop, TEAM.RED) };
  });
  return [
    ...expect('Play safe costs CS', safe.cs <= instinct.cs * 0.85, `${round(safe.cs)} CS against ${round(instinct.cs)} without a call`),
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
    ...expect('Freeze keeps your own farm going', freeze.cs >= instinct.cs * 0.8, `${round(freeze.cs)} CS against ${round(instinct.cs)}`),
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
// you: the same time in base, but they farm under their tower instead of you under yours.
function checkBadReset() {
  const measure = shoveFirst => averageOver(game => {
    if (shoveFirst) {
      call(game.gameState, 'shove');
    } else {
      game.redTop.laneOrders.wave = ACTION_KIND.SHOVE;
      game.redTop.laneOrders.waveSinceSeconds = game.gameState.gameSeconds;
    }
    game.simulation.runTicks(RESET_SETUP_TICKS);
    call(game.gameState, 'reset');
    game.simulation.runTicks(RESET_AWAY_TICKS);
    return { csLead: game.blueTop.creepScore - game.redTop.creepScore };
  }).csLead;
  const good = measure(true);
  const bad = measure(false);
  return expect('A reset after a crash beats one under pressure', good > bad, `CS lead ${round(good)} against ${round(bad)}`);
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
