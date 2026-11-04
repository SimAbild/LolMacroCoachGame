import { opposingTeam } from '../../config/teams.js';
import { ROLE, ROLE_LABELS } from '../../config/roles.js';
import { ACTION_KIND } from '../../config/actions.js';
import {
  COUNTER_GANK_RANGE, FIGHT_ENGAGE_DISTANCE, MAX_WARDS_PER_CHAMPION, PLAY_SAFE_SECONDS, SPOTTED_CHECK_MIN_DISTANCE,
  TRINKET_RECHARGE_SECONDS, WARD_DURATION_SECONDS, WARD_PLACE_DISTANCE,
} from '../../config/combatRules.js';
import {
  CHAMPION_MOVE_SPEED, JUNGLE_CAMP_CLEAR_SECONDS, JUNGLE_CAMP_EXPERIENCE, JUNGLE_CAMP_GOLD, JUNGLE_CAMP_RESPAWN_SECONDS, MAX_PUSH_VALUE,
} from '../../config/gameRules.js';
import { ACTIVITY } from '../activities.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { allChampionStates } from '../gameState.js';
import { LANE_BY_ROLE, wardSpotFor } from '../mapLayout.js';
import { isPositionVisible, visionSourcesFor } from '../vision.js';
import { gatherFight, resolveFight } from './fightSystem.js';
import { lanePushFor } from './laneSystem.js';
import { isCampAlive } from './jungleSystem.js';
import { grantExperience, grantGold } from './economy.js';

const MAX_TRAVEL_SECONDS = 45;
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
    if (action && championState.isAlive) {
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
  [ACTION_KIND.DIVE]: (gameState, championState, definition) => {
    const target = laneOpponentOf(gameState, championState);
    startTravelAction(championState, { kind: ACTION_KIND.DIVE, label: `Dive ${LANE_BY_ROLE[championState.role]}`, targetId: target.id });
  },
  [ACTION_KIND.GANK]: (gameState, championState, definition) => {
    const target = enemyWithRole(gameState, championState.team, definition.targetRole);
    startTravelAction(championState, { kind: ACTION_KIND.GANK, label: definition.label, targetId: target.id });
  },
  [ACTION_KIND.CALL_HELP]: (gameState, caller, definition, helperRole) => {
    const helper = allyWithRole(gameState, caller.team, helperRole);
    const target = laneOpponentOf(gameState, caller);
    cancelAction(gameState, helper);
    if (helper.activity === ACTIVITY.RECALLING) {
      helper.activity = ACTIVITY.TRAVELING;
    }
    caller.activeAction = {
      kind: ACTION_KIND.CALL_HELP,
      label: definition.label,
      linkedChampionId: helper.id,
      statusText: `Waiting for ${helper.champion.name}`,
    };
    startTravelAction(helper, {
      kind: ACTION_KIND.GANK,
      label: `${ROLE_LABELS[caller.role]} + ${ROLE_LABELS[helper.role]} play`,
      targetId: target.id,
      linkedChampionId: caller.id,
    });
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
  [ACTION_KIND.CALL_HELP]: (gameState, caller, action) => {
    const helper = championById(gameState, action.linkedChampionId);
    if (helper.activeAction?.linkedChampionId !== caller.id) {
      endAction(gameState, caller);
    }
  },
  [ACTION_KIND.DIVE]: updateFightTravel,
  [ACTION_KIND.GANK]: updateFightTravel,
  [ACTION_KIND.INVADE]: updateInvade,
  [ACTION_KIND.WARD]: updateWard,
  [ACTION_KIND.FARM]: () => {},
});

function updateFightTravel(gameState, championState, action, tickSeconds) {
  const target = championById(gameState, action.targetId);
  if (!target.isAlive || target.activity === ACTIVITY.IN_FOUNTAIN) {
    abortAction(gameState, championState, `${action.label} called off: ${target.champion.name} left`);
    return;
  }
  const distanceToTarget = distanceBetween(championState.position, target.position);
  if (distanceToTarget <= FIGHT_ENGAGE_DISTANCE) {
    const fight = gatherFight(gameState, { initiator: championState, primaryTarget: target });
    endAction(gameState, championState);
    resolveFight(gameState, fight, { label: action.label, wasSpotted: action.wasSpotted });
    return;
  }
  if (!travelTick(gameState, championState, action, tickSeconds, target.position)) {
    return;
  }
  if (distanceToTarget > SPOTTED_CHECK_MIN_DISTANCE && isSeenByEnemies(gameState, championState)) {
    action.wasSpotted = true;
  }
  action.statusText = `${action.label} (${Math.ceil(distanceToTarget / CHAMPION_MOVE_SPEED)}s)${action.wasSpotted ? ' · spotted' : ''}`;
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
    const fight = gatherFight(gameState, { initiator: championState, primaryTarget: enemyJungler });
    endAction(gameState, championState);
    resolveFight(gameState, fight, { label: 'Invade fight', wasSpotted: false });
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
      return 'Objectives arrive in milestone 4';
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

function isSeenByEnemies(gameState, championState) {
  return isPositionVisible(championState.position, visionSourcesFor(gameState, opposingTeam(championState.team)));
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
