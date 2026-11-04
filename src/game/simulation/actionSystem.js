import { opposingTeam } from '../../config/teams.js';
import { ROLE, ROLE_LABELS } from '../../config/roles.js';
import { ACTION_KIND } from '../../config/actions.js';
import {
  COUNTER_GANK_RANGE, FIGHT_ENGAGE_DISTANCE, MAX_WARDS_PER_CHAMPION, PLAY_SAFE_SECONDS,
  TRINKET_RECHARGE_SECONDS, WARD_DURATION_SECONDS, WARD_PLACE_DISTANCE,
} from '../../config/combatRules.js';
import {
  CHAMPION_MOVE_SPEED, JUNGLE_CAMP_CLEAR_SECONDS, JUNGLE_CAMP_EXPERIENCE, JUNGLE_CAMP_GOLD, JUNGLE_CAMP_RESPAWN_SECONDS, MAX_PUSH_VALUE,
} from '../../config/gameRules.js';
import { ACTIVITY } from '../activities.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { allChampionStates } from '../gameState.js';
import { BARON_PIT, FOUNTAIN_POSITIONS, LANE_BY_ROLE, STRUCTURE_TYPE, wardSpotFor } from '../mapLayout.js';
import { finishPlay, startPlay } from './playSystem.js';
import { lanePushFor } from './laneSystem.js';
import { isCampAlive } from './jungleSystem.js';
import { grantExperience, grantGold } from './economy.js';
import { startTeamfight } from './teamfightSystem.js';
import { startRecall } from './recall.js';
import {
  CONTEST_ARC_STEP_RADIANS, CONTEST_MAX_SECONDS, CONTEST_RALLY_DISTANCE, CONTEST_RALLY_MIN_CHAMPIONS, CONTEST_RALLY_RADIUS, ENGAGE_TRIGGER_DISTANCE, GROUP_SPREAD, GROUP_STANDOFF_DISTANCE, RETREAT_TRAVEL_SECONDS, TEAMFIGHT_JOIN_RANGE,
} from '../../config/teamfightRules.js';
import { OBJECTIVE_RANGE } from '../../config/objectiveRules.js';
import { RECALL_HEALTH_THRESHOLD_DURING_CALL } from '../../config/gameRules.js';
import { chooseObjectiveToContest, isObjectiveRelevant } from '../objectives.js';
import { pointAtLaneDistance } from '../laneGeometry.js';
import { directionTowardEnemy } from './laneSystem.js';

const MAX_TRAVEL_SECONDS = 45;
const TEAM_SIZE = 5;
const MIN_ENEMIES_FOR_GROUP_FIGHT = 2;
const ENGAGE_PHASE = Object.freeze({ APPROACH: 'approach', FIGHTING: 'fighting' });
const FULLY_PUSHED_MARGIN = 2;

export function issueAction(gameState, championState, actionDefinition, { helperRole } = {}) {
  const rejection = rejectionReason(gameState, championState, actionDefinition, helperRole);
  if (rejection) {
    return { isIssued: false, reason: rejection };
  }
  cancelAction(gameState, championState);
  if (championState.activity === ACTIVITY.RECALLING) {
    championState.activity = ACTIVITY.TRAVELING;
  }
  ACTION_STARTERS[actionDefinition.kind](gameState, championState, actionDefinition, helperRole);
  return { isIssued: true };
}

export function cancelAction(gameState, championState) {
  if (championState.activeAction) {
    endAction(gameState, championState);
  }
}

export function updateActions(gameState, tickSeconds) {
  for (const championState of allChampionStates(gameState)) {
    const action = championState.activeAction;
    if (action && championState.isAlive && !championState.inFightId) {
      ACTION_UPDATERS[action.kind](gameState, championState, action, tickSeconds);
    }
  }
}

const ACTION_STARTERS = Object.freeze({
  [ACTION_KIND.SHOVE]: (gameState, championState, definition) => {
    championState.activeAction = { kind: definition.kind, label: definition.label, statusText: 'Shoving wave' };
  },
  [ACTION_KIND.PLAY_SAFE]: (gameState, championState, definition) => {
    championState.activeAction = { kind: definition.kind, label: definition.label, secondsLeft: PLAY_SAFE_SECONDS, statusText: 'Playing safe' };
  },
  [ACTION_KIND.FARM]: () => {},
  [ACTION_KIND.DIVE]: (gameState, championState) => {
    startPlay(gameState, {
      gankers: [],
      target: laneOpponentOf(gameState, championState),
      label: `Dive ${LANE_BY_ROLE[championState.role]}`,
      isDiveCall: true,
      extraOwners: [championState],
    });
  },
  [ACTION_KIND.GANK]: (gameState, championState, definition) => {
    startPlay(gameState, {
      gankers: [championState],
      target: enemyWithRole(gameState, championState.team, definition.targetRole),
      label: definition.label,
    });
  },
  [ACTION_KIND.CALL_HELP]: (gameState, caller, definition, helperRole) => {
    const helper = allyWithRole(gameState, caller.team, helperRole);
    cancelAction(gameState, helper);
    if (helper.activity === ACTIVITY.RECALLING) {
      helper.activity = ACTIVITY.TRAVELING;
    }
    const label = `${ROLE_LABELS[caller.role]} + ${ROLE_LABELS[helper.role]} play`;
    const target = laneOpponentOf(gameState, caller);
    if (caller.role === ROLE.JUNGLE) {
      startPlay(gameState, { gankers: [helper, caller], target, label });
      return;
    }
    startPlay(gameState, { gankers: [helper], target, label, extraOwners: [caller] });
  },
  [ACTION_KIND.INVADE]: (gameState, championState, definition) => {
    const camp = nearestAliveEnemyCamp(gameState, championState);
    startTravelAction(championState, { kind: ACTION_KIND.INVADE, label: definition.label, camp, clearProgressSeconds: 0 });
  },
  [ACTION_KIND.WARD]: (gameState, championState, definition) => {
    startTravelAction(championState, {
      kind: ACTION_KIND.WARD,
      label: definition.label,
      wardPosition: wardSpotFor(championState.team, definition.wardSpot),
    });
  },
  [ACTION_KIND.SETUP_OBJECTIVE]: (gameState, championState, definition) => {
    const objective = chooseObjectiveToContest(gameState);
    const wardSpot = objective.pit === BARON_PIT ? 'objectiveTop' : 'objectiveBot';
    startTravelAction(championState, {
      kind: ACTION_KIND.WARD,
      label: `Setup ${objective.key}`,
      wardPosition: wardSpotFor(championState.team, wardSpot),
    });
  },
});

const ACTION_UPDATERS = Object.freeze({
  [ACTION_KIND.SHOVE]: (gameState, championState) => {
    const laneState = laneStateOf(gameState, championState);
    if (lanePushFor(gameState, laneState, championState.team) >= MAX_PUSH_VALUE - FULLY_PUSHED_MARGIN) {
      endAction(gameState, championState);
    }
  },
  [ACTION_KIND.PLAY_SAFE]: (gameState, championState, action, tickSeconds) => {
    action.secondsLeft -= tickSeconds;
    action.statusText = `Playing safe (${Math.ceil(action.secondsLeft)}s)`;
    if (action.secondsLeft <= 0) {
      endAction(gameState, championState);
    }
  },
  [ACTION_KIND.CALL_HELP]: () => {},
  [ACTION_KIND.DIVE]: () => {},
  [ACTION_KIND.GANK]: () => {},
  [ACTION_KIND.PLAY_SETUP]: () => {},
  [ACTION_KIND.INVADE]: updateInvade,
  [ACTION_KIND.WARD]: updateWard,
  [ACTION_KIND.FARM]: () => {},
  [ACTION_KIND.GROUP]: updateGroup,
  [ACTION_KIND.CONTEST]: updateContest,
  [ACTION_KIND.ENGAGE]: updateEngage,
  [ACTION_KIND.RETREAT]: updateRetreat,
});

export function startTeamAction(championState, action) {
  startTravelAction(championState, action);
}

export function startRetreat(gameState, championState) {
  championState.activeAction = null;
  startTravelAction(championState, {
    kind: ACTION_KIND.RETREAT,
    label: 'Backing off',
    destination: retreatDestination(gameState, championState),
    secondsLeft: RETREAT_TRAVEL_SECONDS,
  });
}

function updateGroup(gameState, championState, action) {
  if (championState.healthRatio < RECALL_HEALTH_THRESHOLD_DURING_CALL) {
    startRecall(championState);
    return;
  }
  const laneState = gameState.lanes.find(candidate => candidate.lane === action.lane);
  const distanceBehindWave = (GROUP_STANDOFF_DISTANCE + action.spreadIndex * GROUP_SPREAD) * directionTowardEnemy(championState.team);
  championState.targetPosition = pointAtLaneDistance(action.lane, laneState.frontDistance - distanceBehindWave);
  action.statusText = 'Grouped mid';
  const nearbyEnemies = livingEnemiesNear(gameState, championState, TEAMFIGHT_JOIN_RANGE);
  if (nearbyEnemies.length >= MIN_ENEMIES_FOR_GROUP_FIGHT) {
    startTeamfight(gameState, midpoint(championState.position, nearbyEnemies[0].position));
  }
}

function updateContest(gameState, championState, action) {
  const objective = gameState.objectives[action.objectiveKey];
  const hasTakenTooLong = gameState.gameSeconds - (action.issuedAtSeconds ?? gameState.gameSeconds) > CONTEST_MAX_SECONDS;
  if (!isObjectiveRelevant(gameState, objective) || hasTakenTooLong) {
    endAction(gameState, championState);
    return;
  }
  if (championState.healthRatio < RECALL_HEALTH_THRESHOLD_DURING_CALL) {
    startRecall(championState);
    return;
  }
  if (!action.hasRallied) {
    const rallyPoint = contestRallyPoint(objective, championState.team);
    championState.targetPosition = rallyPoint;
    action.statusText = `${action.label} (gathering)`;
    if (isTeamRallied(gameState, championState.team, objective, rallyPoint)) {
      markTeamRallied(gameState, championState.team, objective);
    }
    return;
  }
  championState.targetPosition = contestStandingPoint(objective, championState.team, action.spreadIndex);
  const distanceToPit = distanceBetween(championState.position, objective.pit);
  action.statusText = objective.isAlive
    ? `${action.label} (${distanceToPit <= OBJECTIVE_RANGE ? 'taking' : `${Math.ceil(distanceToPit / CHAMPION_MOVE_SPEED)}s`})`
    : `${action.label} (spawns in ${Math.ceil(objective.spawnAtSeconds - gameState.gameSeconds)}s)`;
}

function contestStandingPoint(objective, team, spreadIndex) {
  const fountain = FOUNTAIN_POSITIONS[team];
  const ownSideAngle = Math.atan2(fountain.y - objective.pit.y, fountain.x - objective.pit.x);
  const angle = ownSideAngle + (spreadIndex - (TEAM_SIZE - 1) / 2) * CONTEST_ARC_STEP_RADIANS;
  const arcRadius = OBJECTIVE_RANGE / 2;
  return {
    x: objective.pit.x + Math.cos(angle) * arcRadius,
    y: objective.pit.y + Math.sin(angle) * arcRadius,
  };
}

function contestRallyPoint(objective, team) {
  const fountain = FOUNTAIN_POSITIONS[team];
  const distanceToFountain = distanceBetween(objective.pit, fountain);
  return {
    x: objective.pit.x + ((fountain.x - objective.pit.x) / distanceToFountain) * CONTEST_RALLY_DISTANCE,
    y: objective.pit.y + ((fountain.y - objective.pit.y) / distanceToFountain) * CONTEST_RALLY_DISTANCE,
  };
}

function isTeamRallied(gameState, team, objective, rallyPoint) {
  const contesters = gameState.teams[team].champions.filter(teammate => teammate.isAlive && isContestingObjective(teammate, objective));
  const rallied = contesters.filter(teammate => distanceBetween(teammate.position, rallyPoint) <= CONTEST_RALLY_RADIUS);
  return rallied.length >= Math.min(CONTEST_RALLY_MIN_CHAMPIONS, contesters.length);
}

function markTeamRallied(gameState, team, objective) {
  for (const teammate of gameState.teams[team].champions) {
    if (isContestingObjective(teammate, objective)) {
      teammate.activeAction.hasRallied = true;
    }
  }
}

function isContestingObjective(championState, objective) {
  return championState.activeAction?.kind === ACTION_KIND.CONTEST && championState.activeAction.objectiveKey === objective.key;
}

function updateEngage(gameState, championState, action) {
  if (action.phase === ENGAGE_PHASE.FIGHTING) {
    const fight = gameState.fights.find(candidate => candidate.id === action.fightId);
    if (!fight) {
      endAction(gameState, championState);
      return;
    }
    championState.targetPosition = fight.location;
    action.statusText = 'Joining the fight';
    return;
  }
  const target = championById(gameState, action.targetId);
  if (!target.isAlive || target.activity === ACTIVITY.IN_FOUNTAIN) {
    endAction(gameState, championState);
    return;
  }
  championState.targetPosition = target.position;
  const distanceToTarget = distanceBetween(championState.position, target.position);
  action.statusText = `Engaging ${target.champion.name} (${Math.ceil(distanceToTarget / CHAMPION_MOVE_SPEED)}s)`;
  if (distanceToTarget > ENGAGE_TRIGGER_DISTANCE) {
    return;
  }
  const fight = startTeamfight(gameState, target.position);
  for (const teammate of gameState.teams[championState.team].champions) {
    if (teammate.activeAction?.kind === ACTION_KIND.ENGAGE) {
      teammate.activeAction.phase = ENGAGE_PHASE.FIGHTING;
      teammate.activeAction.fightId = fight.id;
    }
  }
}

function updateRetreat(gameState, championState, action, tickSeconds) {
  championState.targetPosition = action.destination;
  action.secondsLeft -= tickSeconds;
  action.statusText = 'Backing off';
  if (action.secondsLeft <= 0 || distanceBetween(championState.position, action.destination) <= WARD_PLACE_DISTANCE) {
    endAction(gameState, championState);
  }
}

function retreatDestination(gameState, championState) {
  const standingTowers = gameState.teams[championState.team].structures
    .filter(structure => structure.type === STRUCTURE_TYPE.TOWER && structure.isStanding);
  if (standingTowers.length === 0) {
    return { ...FOUNTAIN_POSITIONS[championState.team] };
  }
  const nearestTower = standingTowers.reduce((nearest, tower) => (
    distanceBetween(tower, championState.position) < distanceBetween(nearest, championState.position) ? tower : nearest
  ));
  return { x: nearestTower.x, y: nearestTower.y };
}

function livingEnemiesNear(gameState, championState, range) {
  return gameState.teams[opposingTeam(championState.team)].champions.filter(enemy => enemy.isAlive
    && enemy.activity !== ACTIVITY.IN_FOUNTAIN
    && distanceBetween(enemy.position, championState.position) <= range);
}

function midpoint(first, second) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function updateInvade(gameState, championState, action, tickSeconds) {
  const camp = action.camp;
  if (!isCampAlive(camp, gameState.gameSeconds)) {
    abortAction(gameState, championState, 'Invade called off: camp already taken');
    return;
  }
  const distanceToCamp = distanceBetween(championState.position, camp.position);
  if (distanceToCamp > FIGHT_ENGAGE_DISTANCE) {
    if (travelTick(gameState, championState, action, tickSeconds, camp.position)) {
      action.statusText = `Invading (${Math.ceil(distanceToCamp / CHAMPION_MOVE_SPEED)}s)`;
    }
    return;
  }
  const enemyJungler = enemyWithRole(gameState, championState.team, ROLE.JUNGLE);
  if (enemyJungler.isAlive && distanceBetween(enemyJungler.position, camp.position) <= COUNTER_GANK_RANGE) {
    endAction(gameState, championState);
    startTeamfight(gameState, enemyJungler.position, { label: 'Invade fight', team: championState.team });
    return;
  }
  championState.targetPosition = camp.position;
  action.clearProgressSeconds += tickSeconds;
  action.statusText = 'Stealing camp';
  if (action.clearProgressSeconds >= JUNGLE_CAMP_CLEAR_SECONDS) {
    camp.respawnAtSeconds = gameState.gameSeconds + JUNGLE_CAMP_RESPAWN_SECONDS;
    grantGold(championState, JUNGLE_CAMP_GOLD);
    grantExperience(championState, JUNGLE_CAMP_EXPERIENCE);
    addEvent(gameState, { kind: EVENT_KIND.CALL, team: championState.team, text: `${championState.champion.name} stole an enemy camp` });
    endAction(gameState, championState);
  }
}

function updateWard(gameState, championState, action, tickSeconds) {
  const distanceToSpot = distanceBetween(championState.position, action.wardPosition);
  if (distanceToSpot > WARD_PLACE_DISTANCE) {
    if (travelTick(gameState, championState, action, tickSeconds, action.wardPosition)) {
      action.statusText = `${action.label} (${Math.ceil(distanceToSpot / CHAMPION_MOVE_SPEED)}s)`;
    }
    return;
  }
  placeWard(gameState, championState, action.wardPosition);
  endAction(gameState, championState);
}

function travelTick(gameState, championState, action, tickSeconds, destination) {
  action.elapsedSeconds += tickSeconds;
  if (action.elapsedSeconds > MAX_TRAVEL_SECONDS) {
    abortAction(gameState, championState, `${action.label} called off: took too long`);
    return false;
  }
  championState.targetPosition = destination;
  return true;
}

function placeWard(gameState, championState, position) {
  const ownWards = gameState.wards.filter(ward => ward.ownerId === championState.id);
  if (ownWards.length >= MAX_WARDS_PER_CHAMPION) {
    gameState.wards.splice(gameState.wards.indexOf(ownWards[0]), 1);
  }
  gameState.wards.push({
    team: championState.team,
    ownerId: championState.id,
    position: { ...position },
    expiresAtSeconds: gameState.gameSeconds + WARD_DURATION_SECONDS,
  });
  championState.trinketCharges -= 1;
  if (championState.trinketRechargeSecondsLeft <= 0) {
    championState.trinketRechargeSecondsLeft = TRINKET_RECHARGE_SECONDS;
  }
}

function startTravelAction(championState, action) {
  championState.activeAction = { elapsedSeconds: 0, wasSpotted: false, statusText: action.label, ...action };
  championState.activity = ACTIVITY.ACTING;
  championState.targetCamp = null;
}

function abortAction(gameState, championState, text) {
  if (championState.team === gameState.playerSide) {
    addEvent(gameState, { kind: EVENT_KIND.CALL, team: championState.team, text });
  }
  endAction(gameState, championState);
}

function endAction(gameState, championState) {
  const action = championState.activeAction;
  if (action?.playId) {
    finishPlay(gameState, action.playId, `${action.label} cancelled`);
    return;
  }
  championState.activeAction = null;
  if (championState.activity === ACTIVITY.ACTING) {
    championState.activity = ACTIVITY.TRAVELING;
    championState.targetPosition = null;
  }
  if (!action?.linkedChampionId) {
    return;
  }
  const linkedChampion = championById(gameState, action.linkedChampionId);
  if (linkedChampion.activeAction?.linkedChampionId === championState.id) {
    endAction(gameState, linkedChampion);
  }
}

function rejectionReason(gameState, championState, actionDefinition, helperRole) {
  const name = championState.champion.name;
  if (!championState.isAlive) {
    return `${name} is dead`;
  }
  if (championState.activity === ACTIVITY.IN_FOUNTAIN) {
    return `${name} is in base`;
  }
  switch (actionDefinition.kind) {
    case ACTION_KIND.SETUP_OBJECTIVE:
      return chooseObjectiveToContest(gameState) ? null : 'No objective is up or spawning soon';
    case ACTION_KIND.DIVE:
      return targetRejectionReason(laneOpponentOf(gameState, championState));
    case ACTION_KIND.GANK:
      return targetRejectionReason(enemyWithRole(gameState, championState.team, actionDefinition.targetRole));
    case ACTION_KIND.CALL_HELP:
      return helperRejectionReason(gameState, championState, helperRole);
    case ACTION_KIND.INVADE:
      return nearestAliveEnemyCamp(gameState, championState) ? null : 'No enemy camps are up';
    case ACTION_KIND.WARD:
      return championState.trinketCharges > 0 ? null : 'No ward charges (recharging)';
    default:
      return null;
  }
}

function helperRejectionReason(gameState, caller, helperRole) {
  const helper = allyWithRole(gameState, caller.team, helperRole);
  if (!helper.isAlive || helper.activity === ACTIVITY.IN_FOUNTAIN) {
    return `${helper.champion.name} is not available`;
  }
  return targetRejectionReason(laneOpponentOf(gameState, caller));
}

function targetRejectionReason(target) {
  if (!target.isAlive) {
    return `${target.champion.name} is dead`;
  }
  if (target.activity === ACTIVITY.IN_FOUNTAIN) {
    return `${target.champion.name} is in base`;
  }
  return null;
}

function laneOpponentOf(gameState, championState) {
  const opponentRole = championState.role === ROLE.SUPPORT ? ROLE.BOT : championState.role;
  return enemyWithRole(gameState, championState.team, opponentRole);
}

function enemyWithRole(gameState, team, role) {
  return gameState.teams[opposingTeam(team)].champions.find(candidate => candidate.role === role);
}

function allyWithRole(gameState, team, role) {
  return gameState.teams[team].champions.find(candidate => candidate.role === role);
}

function championById(gameState, championId) {
  return allChampionStates(gameState).find(candidate => candidate.id === championId);
}

function laneStateOf(gameState, championState) {
  return gameState.lanes.find(laneState => laneState.lane === LANE_BY_ROLE[championState.role]);
}

function nearestAliveEnemyCamp(gameState, championState) {
  const aliveEnemyCamps = gameState.jungleCamps.filter(camp => camp.team !== championState.team && isCampAlive(camp, gameState.gameSeconds));
  if (aliveEnemyCamps.length === 0) {
    return null;
  }
  return aliveEnemyCamps.reduce((nearest, camp) => (
    distanceBetween(camp.position, championState.position) < distanceBetween(nearest.position, championState.position) ? camp : nearest
  ));
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
