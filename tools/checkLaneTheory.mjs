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
// Big enough that the lane pressure stays past the point where a careful laner used to fall out of
// farm range (about −0.175).
const BEHIND_LEAD_SIZE = 2;
// Half of the 0.36 drop measured on 2026-11-15 (Task 3 of specs/consequence-rules).
const MIN_PRESSURE_DROP_TWO_AGAINST_ONE = 0.18;
// Half of what was measured on 2026-11-15 (Task 4 of specs/consequence-rules): their ADC gained
// 3.6 CS more on yours, your ADC's lowest health fell by 0.32, and leaving on a crash kept the ADC
// 0.15 healthier.
const MIN_CS_LEAD_GAIN_TWO_AGAINST_ONE = 1.8;
const MIN_HEALTH_DROP_TWO_AGAINST_ONE = 0.16;
const MIN_HEALTH_GAP_ROAM_ON_CRASH = 0.07;
const CAREFUL_TRADE_TICKS = 300;
// About as long as a roam takes from the crash to the fight (measured in the brainstorm: ~21 s).
const ROAM_TICKS = 250;
const CAREFUL_TRADE_MIN_SHARE = 1;

const gameData = await loadGameData();
// What the same lane does with no call at all: the yardstick for the rules below.
const instinct = playWithCall(null);
const instinctRunsForThinRules = playRunsWithCall(null, THIN_RULE_SEEDS);
const rules = [
  checkLeadBecomesCsLead, checkPlaySafeWhileBehindStillFarms, checkPlaySafe, checkTrade, checkFreeze, checkShoveBreaksFreeze, checkGroupOverridesFreeze, checkShoveWithoutPlan, checkSlowPushCrash, checkAbsenceLosesFarm, checkBadReset, checkTwoAgainstOne, checkTwoAgainstOneTiming, checkCarefulTraderTakesFullDamage,
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

function giveLead(championState, size = 1) {
  grantExperience(championState, LEAD_EXPERIENCE * size);
  championState.items.push({ itemId: 0, cost: LEAD_ITEM_GOLD * size, paidGold: LEAD_ITEM_GOLD * size, isStartingItem: false });
}

function checkLeadBecomesCsLead() {
  const withLead = averageOver(game => {
    giveLead(game.blueTop);
    game.simulation.runTicks(LEAD_TEST_TICKS);
    return laneResult(game);
  });
  const csLead = withLead.cs - withLead.enemyCs;
  return expect('A lead becomes a CS lead with no calls', csLead >= 10, `+${round(csLead)} CS after 8 minutes`);
}

// Careful costs a share of the farm, never all of it: a laner who is behind and plays safe still
// stands within farm range (Simon's round-1 rule). The share is fixed at 50 %, a little under the
// 58 % that Play safe's own last-hit factor predicts.
function checkPlaySafeWhileBehindStillFarms() {
  const measure = isSafe => averageOver(game => {
    giveLead(game.redTop, BEHIND_LEAD_SIZE);
    if (isSafe) {
      call(game.gameState, 'playSafe');
    }
    const csAtStart = game.blueTop.creepScore;
    let pressureSum = 0;
    for (let tick = 0; tick < LANE_TEST_TICKS; tick += 1) {
      game.simulation.runTicks(1);
      pressureSum += game.lane.pressureForBlue;
    }
    return { cs: game.blueTop.creepScore - csAtStart, pressure: pressureSum / LANE_TEST_TICKS };
  });
  const safe = measure(true);
  const normal = measure(false);
  return expect('Playing safe while behind still farms', safe.cs > 0 && safe.cs >= normal.cs * 0.5,
    `${round(safe.cs)} CS against ${round(normal.cs)} without Play safe, at an average pressure of ${safe.pressure.toFixed(2)}`);
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

// Keeps a champion out of the game for the next tick, as if dead, the same way for every rule.
function keepAway(championState) {
  championState.isAlive = false;
  championState.activity = ACTIVITY.DEAD;
  championState.activitySecondsLeft = AWAY_TICKS;
}

function laneOf(gameState, lane) {
  return gameState.lanes.find(laneState => laneState.lane === lane);
}

function callFor(gameState, role, actionId) {
  executeCommand(gameState, { type: INTENT.CHAMPION_ACTION, role, actionId });
}

// Bot lane with Blue's support kept away for AWAY_TICKS: Blue's ADC alone against two. `setUp`
// runs first, for example to crash a wave before the support leaves.
function playBotWithSupport({ isSupportAway, setUp = () => {}, awayTicks = AWAY_TICKS }) {
  return averageOver(game => {
    setUp(game);
    const support = championOf(game.gameState, TEAM.BLUE, ROLE.SUPPORT);
    const blueAdc = championOf(game.gameState, TEAM.BLUE, ROLE.BOT);
    const redAdc = championOf(game.gameState, TEAM.RED, ROLE.BOT);
    const botLane = laneOf(game.gameState, 'bot');
    const csAtStart = { blue: blueAdc.creepScore, red: redAdc.creepScore };
    let pressureSum = 0;
    let lowestHealth = blueAdc.healthRatio;
    for (let tick = 0; tick < awayTicks; tick += 1) {
      if (isSupportAway) {
        keepAway(support);
      }
      game.simulation.runTicks(1);
      pressureSum += botLane.pressureForBlue;
      lowestHealth = Math.min(lowestHealth, blueAdc.healthRatio);
    }
    const cs = blueAdc.creepScore - csAtStart.blue;
    return { pressure: pressureSum / awayTicks, cs, enemyCsLead: redAdc.creepScore - csAtStart.red - cs, lowestHealth };
  });
}

// Two laners weigh more than one: with Blue's support away, Blue's ADC is under more pressure,
// falls behind in CS and gets worn down.
function checkTwoAgainstOne() {
  const away = playBotWithSupport({ isSupportAway: true });
  const present = playBotWithSupport({ isSupportAway: false });
  const pressureDrop = present.pressure - away.pressure;
  const csLeadGain = away.enemyCsLead - present.enemyCsLead;
  const healthDrop = present.lowestHealth - away.lowestHealth;
  return [
    ...expect('Two laners against one push the pressure', pressureDrop >= MIN_PRESSURE_DROP_TWO_AGAINST_ONE,
      `bot pressure ${away.pressure.toFixed(2)} with the support away against ${present.pressure.toFixed(2)} present (drop ${pressureDrop.toFixed(2)})`),
    ...expect('Alone against two loses the lane', csLeadGain >= MIN_CS_LEAD_GAIN_TWO_AGAINST_ONE,
      `their ADC gains ${away.enemyCsLead.toFixed(1)} CS on yours with the support away against ${present.enemyCsLead.toFixed(1)} present`),
    ...expect('Two wear one down', healthDrop >= MIN_HEALTH_DROP_TWO_AGAINST_ONE,
      `your ADC's lowest health ${away.lowestHealth.toFixed(2)} with the support away against ${present.lowestHealth.toFixed(2)} present`),
  ];
}

// Playing safe alone against two still farms (the cap on how far back a laner stands), and a
// support who leaves on a crashed wave leaves the ADC far safer than one who leaves into a wave
// crashing on their own tower.
function checkTwoAgainstOneTiming() {
  const safeAlone = playBotWithSupport({ isSupportAway: true, setUp: game => callFor(game.gameState, ROLE.BOT, 'playSafe') });
  const crashed = playBotWithSupport({ isSupportAway: true, setUp: game => shoveFirst(game, TEAM.BLUE), awayTicks: ROAM_TICKS });
  const pushedIn = playBotWithSupport({ isSupportAway: true, setUp: game => shoveFirst(game, TEAM.RED), awayTicks: ROAM_TICKS });
  const healthGap = crashed.lowestHealth - pushedIn.lowestHealth;
  return [
    ...expect('Playing safe alone against two still farms', safeAlone.cs > 0, `${safeAlone.cs.toFixed(1)} CS in ${AWAY_TICKS / 10} s`),
    ...expect('Leaving on a crashed wave costs the ADC less', healthGap >= MIN_HEALTH_GAP_ROAM_ON_CRASH,
      `your ADC's lowest health ${crashed.lowestHealth.toFixed(2)} after your crash against ${pushedIn.lowestHealth.toFixed(2)} with their wave on your tower`),
  ];
}

// The given team's bot ADC shoves until its wave stands at the enemy tower (or RESET_SETUP_TICKS
// pass), then the order ends: the moment a support would roam on the crash.
function shoveFirst(game, team) {
  const adc = championOf(game.gameState, team, ROLE.BOT);
  const botLane = laneOf(game.gameState, 'bot');
  adc.laneOrders.wave = ACTION_KIND.SHOVE;
  adc.laneOrders.waveSinceSeconds = game.gameState.gameSeconds;
  for (let tick = 0; tick < RESET_SETUP_TICKS && lanePushFor(game.gameState, botLane, team) < CRASH_PUSH; tick += 1) {
    game.simulation.runTicks(1);
  }
  adc.laneOrders.wave = null;
}

// Being careful must never make a trade safer: a careful laner who holds a Trade order takes the
// trade's full damage.
function checkCarefulTraderTakesFullDamage() {
  const healthLost = isCareful => averageOver(game => {
    call(game.gameState, 'trade');
    const healthAtStart = game.blueTop.healthRatio;
    let lowestHealth = healthAtStart;
    for (let tick = 0; tick < CAREFUL_TRADE_TICKS; tick += 1) {
      if (isCareful) {
        game.blueTop.cautiousUntilSeconds = game.gameState.gameSeconds + 1;
      }
      game.simulation.runTicks(1);
      lowestHealth = Math.min(lowestHealth, game.blueTop.healthRatio);
    }
    return { lost: healthAtStart - lowestHealth };
  }).lost;
  const careful = healthLost(true);
  const normal = healthLost(false);
  return expect('A careful trader takes the full trade', careful >= normal * CAREFUL_TRADE_MIN_SHARE,
    `health lost ${careful.toFixed(3)} when careful against ${normal.toFixed(3)}`);
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
