import { opposingTeam } from '../../config/teams.js';
import { ROLE } from '../../config/roles.js';
import { ACTION_KIND, ROLE_ACTIONS, TEAM_CALL } from '../../config/actions.js';
import { DEFAULT_AI_WEIGHTS } from '../../config/aiWeights.js';
import { MAX_PUSH_VALUE } from '../../config/gameRules.js';
import { OBJECTIVE_KEY } from '../../config/objectiveRules.js';
import { ACTIVITY } from '../activities.js';
import { BARON_PIT, LANE_BY_ROLE, wardSpotFor } from '../mapLayout.js';
import { chooseObjectiveToContest, upcomingObjectiveTimers } from '../objectives.js';
import { fightPowerOf, hasBaron } from '../teamPower.js';
import { totalTeamGold } from '../gameState.js';
import { isPositionVisible, teamVisionSources } from '../vision.js';
import { issueAction } from './actionSystem.js';
import { issueTeamCall } from './teamCallSystem.js';
import { lanePushFor } from './laneSystem.js';
import { lastSeenPosition, secondsSinceSeen } from './intelSystem.js';

const DECISION_INTERVAL_SECONDS = 4;
const COOLDOWN_SECONDS = Object.freeze({
  gank: 45, roam: 50, ward: 50, setup: 60, contest: 25, group: 60, engage: 20, dive: 40, shove: 30,
});
const LANER_ROLE_BY_LANE = Object.freeze({ top: ROLE.TOP, mid: ROLE.MID, bot: ROLE.BOT });
const LANES = Object.freeze(['top', 'mid', 'bot']);
const MIN_GANKER_HEALTH = 0.5;
const OBJECTIVE_SOON_SECONDS = 40;
const WARD_LOOKAHEAD_SECONDS = 75;
const WARD_EARLIEST_SECONDS = 20;
const SETUP_EARLIEST_SECONDS = 30;
const SETUP_LATEST_SECONDS = 70;
const CONTEST_LOOKAHEAD_SECONDS = 30;
const SHOVE_LOOKAHEAD_SECONDS = 45;
const OWN_WARD_COVERAGE_DISTANCE = 140;
const JUNGLER_FAR_DISTANCE = 500;
const JUNGLER_NEAR_DISTANCE = 350;
const JUNGLER_FAR_INTEL_SECONDS = 15;
const JUNGLER_NEAR_INTEL_SECONDS = 10;
const JUNGLER_MISSING_SECONDS = 30;
const PIT_THREAT_RANGE = 300;
const GROUP_EARLIEST_SECONDS = 1080;
const ENGAGE_SEARCH_RANGE = 400;
const MIN_GROUPED_FOR_ENGAGE = 3;
const MIN_VISIBLE_ENEMIES_FOR_ENGAGE = 2;
const DIVE_MIN_PUSH = 0.8;
const DIVE_MAX_TARGET_HEALTH = 0.45;
const DIVE_MIN_OWN_HEALTH = 0.6;
const DIVE_SETUP_MIN_PUSH = 0.6;
const DIVE_SETUP_MIN_LANER_HEALTH = 0.6;
const SHOVE_MAX_PUSH = 0.5;
const ROAM_MIN_PUSH = 0.3;
const GOLD_PER_THOUSAND = 1000;
const DISTANCE_PER_THOUSAND = 1000;
const MAX_POWER_ADVANTAGE = 1;
const HALF_CHANCE = 0.5;
const TEAM_ACTION_KINDS = Object.freeze([ACTION_KIND.CONTEST, ACTION_KIND.GROUP, ACTION_KIND.ENGAGE]);
const IDLE_ACTIVITIES = Object.freeze([ACTIVITY.LANING, ACTIVITY.JUNGLING, ACTIVITY.TRAVELING]);
const OBJECTIVE_LANES = Object.freeze({
  [OBJECTIVE_KEY.DRAGON]: ['bot', 'mid'],
  [OBJECTIVE_KEY.ELDER]: ['bot', 'mid'],
  [OBJECTIVE_KEY.GRUBS]: ['top', 'mid'],
  [OBJECTIVE_KEY.HERALD]: ['top', 'mid'],
  [OBJECTIVE_KEY.BARON]: ['top', 'mid'],
});

export function updateAiCoach(gameState) {
  for (const team of gameState.aiControlledTeams) {
    const weights = { ...DEFAULT_AI_WEIGHTS, ...gameState.aiWeightsByTeam[team] };
    gameState.aiCoaches[team] ??= { nextDecisionSeconds: 0, cooldownUntil: {}, decisionCounts: {} };
    const coach = gameState.aiCoaches[team];
    backOffFromLosingFights(gameState, team, weights);
    if (gameState.gameSeconds < coach.nextDecisionSeconds) {
      continue;
    }
    coach.nextDecisionSeconds = gameState.gameSeconds + DECISION_INTERVAL_SECONDS;
    makeBestDecision(gameState, coach, createContext(gameState, team, weights));
  }
}

function makeBestDecision(gameState, coach, context) {
  const options = DECISION_SOURCES
    .flatMap(source => source(context))
    .filter(option => (coach.cooldownUntil[option.cooldownKey] ?? 0) <= gameState.gameSeconds);
  if (options.length === 0) {
    return;
  }
  const best = options.reduce((highest, option) => (option.score > highest.score ? option : highest));
  if (best.score < context.weights.minimumDecisionScore) {
    return;
  }
  if (best.execute().isIssued) {
    coach.cooldownUntil[best.cooldownKey] = gameState.gameSeconds + COOLDOWN_SECONDS[best.type];
    coach.decisionCounts[best.type] = (coach.decisionCounts[best.type] ?? 0) + 1;
  }
}

function createContext(gameState, team, weights) {
  const enemyTeam = opposingTeam(team);
  const own = gameState.teams[team].champions;
  const enemies = gameState.teams[enemyTeam].champions;
  const enemyJungler = enemies.find(enemy => enemy.role === ROLE.JUNGLE);
  const ownPower = livingPower(gameState, own);
  const enemyPower = livingPower(gameState, enemies);
  return {
    gameState,
    team,
    weights,
    own,
    enemies,
    aliveAdvantage: aliveCount(own) - aliveCount(enemies),
    powerAdvantage: Math.min(MAX_POWER_ADVANTAGE, enemyPower > 0 ? ownPower / enemyPower - 1 : MAX_POWER_ADVANTAGE),
    goldLead: totalTeamGold(gameState.teams[team]) - totalTeamGold(gameState.teams[enemyTeam]),
    enemyJungler,
    enemyJunglerSecondsSinceSeen: secondsSinceSeen(gameState, team, enemyJungler.id),
    enemyJunglerLastPosition: lastSeenPosition(gameState, team, enemyJungler.id),
    nextObjective: upcomingObjectiveTimers(gameState)[0] ?? null,
    isTeamBusy: own.some(championState => TEAM_ACTION_KINDS.includes(championState.activeAction?.kind)),
  };
}

const DECISION_SOURCES = Object.freeze([
  gankOptions, roamOptions, wardOptions, setupOptions, contestOptions, groupOptions, engageOptions, diveOptions, shoveOptions,
]);

function gankOptions(context) {
  const jungler = ownWithRole(context, ROLE.JUNGLE);
  if (!isIdle(jungler) || jungler.healthRatio < MIN_GANKER_HEALTH) {
    return [];
  }
  return LANES.flatMap(lane => {
    const target = laneTargetOf(context, lane);
    if (!target) {
      return [];
    }
    const action = actionById(ROLE.JUNGLE, `gank${capitalize(lane)}`);
    const score = context.weights.gankBase + gankAppeal(context, jungler, lane, target);
    return [option('gank', 'gank', score, () => issueAction(context.gameState, jungler, action))];
  });
}

function roamOptions(context) {
  const midLaner = ownWithRole(context, ROLE.MID);
  if (!isIdle(midLaner) || midLaner.activity !== ACTIVITY.LANING || midLaner.healthRatio < MIN_GANKER_HEALTH) {
    return [];
  }
  const ownPush = pushOf(context, 'mid');
  if (ownPush < ROAM_MIN_PUSH) {
    return [];
  }
  return ['top', 'bot'].flatMap(lane => {
    const target = laneTargetOf(context, lane);
    if (!target) {
      return [];
    }
    const score = context.weights.roamBase + context.weights.roamOwnWavePushed * ownPush + gankAppeal(context, midLaner, lane, target);
    const action = actionById(ROLE.MID, `roam${capitalize(lane)}`);
    return [option('roam', 'roam', score, () => issueAction(context.gameState, midLaner, action))];
  });
}

function wardOptions(context) {
  const support = ownWithRole(context, ROLE.SUPPORT);
  if (!isIdle(support) || support.activity !== ACTIVITY.LANING || support.trinketCharges <= 0) {
    return [];
  }
  const { weights } = context;
  const timer = context.nextObjective;
  if (timer && timer.secondsUntilSpawn <= WARD_LOOKAHEAD_SECONDS && timer.secondsUntilSpawn >= WARD_EARLIEST_SECONDS) {
    const wardSpot = timer.objective.pit === BARON_PIT ? 'objectiveTop' : 'objectiveBot';
    if (!hasOwnWardNear(context, wardSpotFor(context.team, wardSpot))) {
      const urgency = 1 - timer.secondsUntilSpawn / WARD_LOOKAHEAD_SECONDS;
      const action = actionById(ROLE.SUPPORT, wardSpot === 'objectiveTop' ? 'wardObjectiveTop' : 'wardObjectiveBot');
      return [option('ward', 'ward', weights.wardObjectiveBase + weights.wardObjectiveSoon * urgency, () => issueAction(context.gameState, support, action))];
    }
  }
  if (context.enemyJunglerSecondsSinceSeen >= JUNGLER_MISSING_SECONDS) {
    const deepSpot = context.gameState.random() < HALF_CHANCE ? 'deepWardTop' : 'deepWardBot';
    const action = actionById(ROLE.SUPPORT, deepSpot);
    return [option('ward', 'ward', weights.wardObjectiveBase + weights.wardDeepWhenJunglerMissing, () => issueAction(context.gameState, support, action))];
  }
  return [];
}

function setupOptions(context) {
  const jungler = ownWithRole(context, ROLE.JUNGLE);
  const timer = context.nextObjective;
  const isSetupWindow = timer && timer.secondsUntilSpawn >= SETUP_EARLIEST_SECONDS && timer.secondsUntilSpawn <= SETUP_LATEST_SECONDS;
  if (!isIdle(jungler) || !isSetupWindow || jungler.trinketCharges <= 0) {
    return [];
  }
  const wardSpot = timer.objective.pit === BARON_PIT ? 'objectiveTop' : 'objectiveBot';
  if (hasOwnWardNear(context, wardSpotFor(context.team, wardSpot))) {
    return [];
  }
  const action = actionById(ROLE.JUNGLE, 'setupObjective');
  return [option('setup', 'setup', context.weights.setupObjectiveBase, () => issueAction(context.gameState, jungler, action))];
}

function contestOptions(context) {
  if (context.isTeamBusy) {
    return [];
  }
  const objective = chooseObjectiveToContest(context.gameState);
  if (!objective) {
    return [];
  }
  const secondsUntilSpawn = objective.isAlive ? 0 : objective.spawnAtSeconds - context.gameState.gameSeconds;
  if (secondsUntilSpawn > CONTEST_LOOKAHEAD_SECONDS) {
    return [];
  }
  const { weights } = context;
  const objectiveValue = {
    [OBJECTIVE_KEY.DRAGON]: weights.contestValueDragon,
    [OBJECTIVE_KEY.GRUBS]: weights.contestValueGrubs,
    [OBJECTIVE_KEY.HERALD]: weights.contestValueHerald,
    [OBJECTIVE_KEY.BARON]: weights.contestValueBaron,
    [OBJECTIVE_KEY.ELDER]: weights.contestValueElder,
  }[objective.key];
  const lanesWithPriority = OBJECTIVE_LANES[objective.key].filter(lane => pushOf(context, lane) > 0).length;
  const enemiesSeenAtPit = visibleEnemiesNear(context, objective.pit, PIT_THREAT_RANGE).length;
  const score = weights.contestBase + objectiveValue
    + weights.contestPerAliveAdvantage * context.aliveAdvantage
    + weights.contestPowerAdvantage * context.powerAdvantage
    + weights.contestLanePriority * lanesWithPriority
    - weights.contestEnemyAtPit * enemiesSeenAtPit;
  return [option('contest', 'contest', score, () => issueTeamCall(context.gameState, context.team, TEAM_CALL.CONTEST_OBJECTIVE))];
}

function groupOptions(context) {
  if (context.isTeamBusy || context.gameState.gameSeconds < GROUP_EARLIEST_SECONDS) {
    return [];
  }
  const { weights } = context;
  const score = weights.groupBase
    + weights.groupGoldLeadPerThousand * (context.goldLead / GOLD_PER_THOUSAND)
    + (hasBaron(context.gameState, context.team) ? weights.groupBaronBuff : 0)
    + weights.groupAliveAdvantage * context.aliveAdvantage;
  return [option('group', 'group', score, () => issueTeamCall(context.gameState, context.team, TEAM_CALL.GROUP_MID))];
}

function engageOptions(context) {
  const grouped = context.own.filter(championState => championState.isAlive && championState.activeAction?.kind === ACTION_KIND.GROUP);
  if (grouped.length < MIN_GROUPED_FOR_ENGAGE) {
    return [];
  }
  const visibleEnemies = visibleEnemiesNear(context, centroidOf(grouped), ENGAGE_SEARCH_RANGE);
  if (visibleEnemies.length < MIN_VISIBLE_ENEMIES_FOR_ENGAGE) {
    return [];
  }
  const { weights } = context;
  const score = weights.engageBase + weights.engagePowerAdvantage * context.powerAdvantage + weights.engageAliveAdvantage * context.aliveAdvantage;
  return [option('engage', 'engage', score, () => issueTeamCall(context.gameState, context.team, TEAM_CALL.ENGAGE))];
}

function diveOptions(context) {
  return [ROLE.TOP, ROLE.BOT].flatMap(role => {
    const laner = ownWithRole(context, role);
    const lane = LANE_BY_ROLE[role];
    const target = laneTargetOf(context, lane);
    const isGoodDive = isIdle(laner) && laner.activity === ACTIVITY.LANING && target
      && pushOf(context, lane) >= DIVE_MIN_PUSH && target.healthRatio <= DIVE_MAX_TARGET_HEALTH && laner.healthRatio >= DIVE_MIN_OWN_HEALTH;
    if (!isGoodDive) {
      return [];
    }
    const { weights } = context;
    const score = weights.diveBase + weights.diveTargetLowHealth * (1 - target.healthRatio) + weights.diveOwnHealth * laner.healthRatio;
    return [option('dive', `dive-${lane}`, score, () => issueAction(context.gameState, laner, actionById(role, 'dive')))];
  });
}

function shoveOptions(context) {
  const timer = context.nextObjective;
  if (!timer || timer.secondsUntilSpawn > SHOVE_LOOKAHEAD_SECONDS) {
    return [];
  }
  return OBJECTIVE_LANES[timer.objective.key].flatMap(lane => {
    const laner = ownWithRole(context, LANER_ROLE_BY_LANE[lane]);
    if (!isIdle(laner) || laner.activity !== ACTIVITY.LANING || pushOf(context, lane) >= SHOVE_MAX_PUSH) {
      return [];
    }
    const action = actionById(laner.role, 'shove');
    return [option('shove', `shove-${lane}`, context.weights.shoveForObjective, () => issueAction(context.gameState, laner, action))];
  });
}

function gankAppeal(context, ganker, lane, target) {
  const { weights, gameState } = context;
  const push = pushOf(context, lane);
  const ownLaner = ownWithRole(context, LANER_ROLE_BY_LANE[lane]);
  const canSetUpDive = push >= DIVE_SETUP_MIN_PUSH && ownLaner?.isAlive && ownLaner.healthRatio >= DIVE_SETUP_MIN_LANER_HEALTH;
  const targetHasNoFlash = target.summonerSpells.some(spell => spell.spellId === 'flash' && spell.cooldownSeconds > 0);
  const levelLead = ganker.level - target.level;
  const junglerPosition = context.enemyJunglerLastPosition;
  const isJunglerFarAway = junglerPosition && context.enemyJunglerSecondsSinceSeen <= JUNGLER_FAR_INTEL_SECONDS
    && distanceBetween(junglerPosition, target.position) >= JUNGLER_FAR_DISTANCE;
  const isJunglerNearby = junglerPosition && context.enemyJunglerSecondsSinceSeen <= JUNGLER_NEAR_INTEL_SECONDS
    && distanceBetween(junglerPosition, target.position) <= JUNGLER_NEAR_DISTANCE;
  const isObjectiveSoon = context.nextObjective && context.nextObjective.secondsUntilSpawn <= OBJECTIVE_SOON_SECONDS
    && !OBJECTIVE_LANES[context.nextObjective.objective.key].includes(lane);
  return weights.gankEnemyPushedIn * Math.max(0, -push)
    + (canSetUpDive ? weights.gankDiveSetup : 0)
    + weights.gankTargetLowHealth * (1 - target.healthRatio)
    + (targetHasNoFlash ? weights.gankTargetNoFlash : 0)
    + weights.gankLevelLead * levelLead
    + (isJunglerFarAway ? weights.gankEnemyJunglerFarAway : 0)
    - (isJunglerNearby ? weights.gankEnemyJunglerNearby : 0)
    - (isObjectiveSoon ? weights.gankObjectiveSoon : 0)
    - weights.gankTravelPerThousand * (distanceBetween(ganker.position, target.position) / DISTANCE_PER_THOUSAND)
    + weights.gankRating * ganker.champion.ratings.gank
    + (gameState.gameSeconds < target.cautiousUntilSeconds ? -weights.gankDiveSetup : 0);
}

function backOffFromLosingFights(gameState, team, weights) {
  for (const fight of gameState.fights) {
    const ownFighters = fighters(gameState, fight, team);
    const enemyFighters = fighters(gameState, fight, opposingTeam(team));
    if (ownFighters.length === 0 || enemyFighters.length === 0 || fight.backedOffTeams?.includes(team)) {
      continue;
    }
    if (livingPower(gameState, ownFighters) < weights.backOffPowerRatio * livingPower(gameState, enemyFighters)) {
      fight.backedOffTeams = [...(fight.backedOffTeams ?? []), team];
      issueTeamCall(gameState, team, TEAM_CALL.BACK_OFF);
    }
  }
}

function fighters(gameState, fight, team) {
  return gameState.teams[team].champions.filter(championState => championState.inFightId === fight.id && !championState.isFleeing);
}

function laneTargetOf(context, lane) {
  const target = context.enemies.find(enemy => enemy.role === LANER_ROLE_BY_LANE[lane]);
  return target.isAlive && target.activity === ACTIVITY.LANING ? target : null;
}

function visibleEnemiesNear(context, position, range) {
  const teamVision = teamVisionSources(context.gameState, context.team);
  return context.enemies.filter(enemy => enemy.isAlive
    && distanceBetween(enemy.position, position) <= range
    && isPositionVisible(enemy.position, teamVision));
}

function hasOwnWardNear(context, position) {
  return context.gameState.wards.some(ward => ward.team === context.team && distanceBetween(ward.position, position) <= OWN_WARD_COVERAGE_DISTANCE);
}

function pushOf(context, lane) {
  const laneState = context.gameState.lanes.find(candidate => candidate.lane === lane);
  return lanePushFor(context.gameState, laneState, context.team) / MAX_PUSH_VALUE;
}

function isIdle(championState) {
  return Boolean(championState) && championState.isAlive && !championState.activeAction && !championState.inFightId
    && IDLE_ACTIVITIES.includes(championState.activity);
}

function ownWithRole(context, role) {
  return context.own.find(championState => championState.role === role);
}

function actionById(role, actionId) {
  return ROLE_ACTIONS[role].find(action => action.id === actionId);
}

function option(type, cooldownKey, score, execute) {
  return { type, cooldownKey, score, execute };
}

function livingPower(gameState, championStates) {
  return championStates.filter(championState => championState.isAlive)
    .reduce((sum, championState) => sum + fightPowerOf(gameState, championState) * championState.healthRatio, 0);
}

function aliveCount(championStates) {
  return championStates.filter(championState => championState.isAlive).length;
}

function centroidOf(championStates) {
  return {
    x: championStates.reduce((sum, championState) => sum + championState.position.x, 0) / championStates.length,
    y: championStates.reduce((sum, championState) => sum + championState.position.y, 0) / championStates.length,
  };
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
