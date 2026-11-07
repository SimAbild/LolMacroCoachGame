import { opposingTeam } from '../../config/teams.js';
import { ROLE } from '../../config/roles.js';
import { ACTION_KIND } from '../../config/actions.js';
import { CHAMPION_MOVE_SPEED } from '../../config/gameRules.js';
import { SPOTTED_CHECK_MIN_DISTANCE, UNDER_TOWER_RANGE } from '../../config/combatRules.js';
import {
  AMBUSH_ARRIVAL_DISTANCE, AMBUSH_BEHIND_WAVE_DISTANCE, AMBUSH_DIVE_DISTANCE, AMBUSH_SIDE_OFFSET, AMBUSH_UPDATE_SECONDS,
  CATCH_ROOT_BASE_SECONDS, CATCH_ROOT_PER_GANK_RATING, DIVE_ENGAGE_RANGE, DIVE_PUSH_THRESHOLD, ENGAGE_RANGE,
  FORCE_ENGAGE_RANGE, LANE_TANGENT_SAMPLE, PLAY_JOIN_RANGE, PLAY_PLAN, PLAY_MAX_SECONDS, PLAY_WAIT_MAX_SECONDS, SPOTTED_REACTION_SECONDS,
  ROAM_SHOVE_MAX_SECONDS, ROAM_SHOVE_PUSH, SHOVE_STANCE,
} from '../../config/playRules.js';
import { ACTIVITY } from '../activities.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { allChampionStates } from '../gameState.js';
import { LANE_BY_ROLE, STRUCTURE_TYPE } from '../mapLayout.js';
import { pointAtLaneDistance } from '../laneGeometry.js';
import { nearestWalkable } from '../navigation.js';
import { SCRIPTED_ROLL, takeScriptedRoll } from '../random.js';
import { isPositionVisible, teamVisionSources } from '../vision.js';
import { computeFightChance, describeTopModifiers, gatherFight } from './fightSystem.js';
import { directionTowardEnemy, lanePushFor, waveFrontLimits } from './laneSystem.js';
import { startTeamfight } from './teamfightSystem.js';

const PERCENT = 100;
const AT_LIMIT_TOLERANCE = 1;

const PHASE = Object.freeze({ PREPARE: 'prepare', SETUP: 'setup', WAITING: 'waiting' });
const LANER_ROLES = Object.freeze([ROLE.TOP, ROLE.MID, ROLE.BOT]);

export function startPlay(gameState, { gankers, target, label, isDiveCall = false, extraOwners = [] }) {
  const team = gankers[0]?.team ?? extraOwners[0].team;
  const lane = target.role === ROLE.JUNGLE ? null : LANE_BY_ROLE[target.role];
  const owners = laneOwnersFor(gameState, team, lane, gankers, extraOwners);
  const play = {
    id: gameState.nextPlayId,
    team,
    lane,
    label,
    plan: choosePlan(gameState, { lane, team, gankers, isDiveCall }),
    phase: gankers.some(isLanerWhoShouldShoveFirst) ? PHASE.PREPARE : PHASE.SETUP,
    gankerIds: gankers.map(ganker => ganker.id),
    ownerIds: owners.map(owner => owner.id),
    targetId: target.id,
    startedAtSeconds: gameState.gameSeconds,
    phaseStartedAtSeconds: gameState.gameSeconds,
    nextAmbushUpdateSeconds: 0,
    ambushPoint: null,
    wasSpotted: false,
  };
  gameState.nextPlayId += 1;
  gameState.plays.push(play);
  for (const ganker of gankers) {
    if (play.phase === PHASE.PREPARE && isLanerWhoShouldShoveFirst(ganker)) {
      ganker.activeAction = { kind: ACTION_KIND.PLAY_SETUP, playId: play.id, stance: SHOVE_STANCE, label, statusText: `${label} · shoving first` };
    } else {
      sendGankerOut(ganker, play);
    }
  }
  for (const owner of owners) {
    owner.activeAction = { kind: ACTION_KIND.PLAY_SETUP, playId: play.id, plan: play.plan, label, statusText: label };
  }
  if (team === gameState.playerSide) {
    addEvent(gameState, { kind: EVENT_KIND.CALL, team, text: `${label}: ${describePlan(play, gankers, owners, target)}` });
  }
  return play;
}

export function finishPlay(gameState, playId, abortText = null) {
  const play = gameState.plays.find(candidate => candidate.id === playId);
  if (!play) {
    return;
  }
  gameState.plays.splice(gameState.plays.indexOf(play), 1);
  for (const championState of allChampionStates(gameState)) {
    if (championState.activeAction?.playId !== playId) {
      continue;
    }
    championState.activeAction = null;
    if (championState.activity === ACTIVITY.ACTING) {
      championState.activity = ACTIVITY.TRAVELING;
      championState.targetPosition = null;
    }
  }
  if (abortText && play.team === gameState.playerSide) {
    addEvent(gameState, { kind: EVENT_KIND.CALL, team: play.team, text: abortText });
  }
}

export function updatePlays(gameState) {
  for (const play of [...gameState.plays]) {
    updatePlay(gameState, play);
  }
}

function updatePlay(gameState, play) {
  const target = championById(gameState, play.targetId);
  if (!target.isAlive || target.activity === ACTIVITY.IN_FOUNTAIN) {
    finishPlay(gameState, play.id, `${play.label} called off: ${target.champion.name} left`);
    return;
  }
  const gankers = participantsOf(gameState, play, play.gankerIds);
  const owners = participantsOf(gameState, play, play.ownerIds);
  const attackersLeft = play.plan === PLAY_PLAN.DIVE ? gankers.length + owners.length : gankers.length;
  if (attackersLeft === 0) {
    finishPlay(gameState, play.id, `${play.label} called off`);
    return;
  }
  if (gameState.gameSeconds - play.startedAtSeconds > PLAY_MAX_SECONDS) {
    finishPlay(gameState, play.id, `${play.label} called off: took too long`);
    return;
  }
  updateOwnerStatus(gameState, play, owners, target);
  if (play.phase === PHASE.PREPARE) {
    updatePreparation(gameState, play, gankers);
    return;
  }
  if (play.plan === PLAY_PLAN.CHASE) {
    updateChase(gameState, play, gankers, target);
    return;
  }
  updateAmbushPoint(gameState, play, gankers);
  moveGankersToAmbush(gameState, play, gankers, target);
  if (play.phase === PHASE.SETUP && gankers.every(ganker => distanceBetween(ganker.position, play.ambushPoint) <= AMBUSH_ARRIVAL_DISTANCE)) {
    play.phase = PHASE.WAITING;
    play.phaseStartedAtSeconds = gameState.gameSeconds;
  }
  if (play.phase !== PHASE.WAITING) {
    return;
  }
  const attackers = [...gankers, ...owners];
  const initiators = gankers.length > 0 ? gankers : owners;
  if (isTriggerMet(gameState, play, initiators, target)) {
    engage(gameState, play, attackers, target, initiators);
    return;
  }
  if (gameState.gameSeconds - play.phaseStartedAtSeconds > PLAY_WAIT_MAX_SECONDS) {
    if (nearestDistance(initiators, target) <= FORCE_ENGAGE_RANGE) {
      engage(gameState, play, attackers, target, initiators);
    } else {
      finishPlay(gameState, play.id, `${play.label} called off: ${target.champion.name} never came close`);
    }
  }
}

function isLanerWhoShouldShoveFirst(championState) {
  return LANER_ROLES.includes(championState.role) && championState.activity === ACTIVITY.LANING;
}

function sendGankerOut(ganker, play) {
  ganker.activeAction = { kind: ACTION_KIND.GANK, playId: play.id, label: play.label, statusText: play.label };
  ganker.activity = ACTIVITY.ACTING;
  ganker.targetCamp = null;
}

function updatePreparation(gameState, play, gankers) {
  const preparing = gankers.filter(ganker => ganker.activeAction.stance === SHOVE_STANCE);
  const hasWaitedLongEnough = gameState.gameSeconds - play.phaseStartedAtSeconds >= ROAM_SHOVE_MAX_SECONDS;
  const isWaveShoved = preparing.every(ganker => {
    const laneState = gameState.lanes.find(candidate => candidate.lane === LANE_BY_ROLE[ganker.role]);
    return lanePushFor(gameState, laneState, ganker.team) >= ROAM_SHOVE_PUSH;
  });
  if (!hasWaitedLongEnough && !isWaveShoved) {
    return;
  }
  for (const ganker of preparing) {
    sendGankerOut(ganker, play);
  }
  play.phase = PHASE.SETUP;
  play.phaseStartedAtSeconds = gameState.gameSeconds;
}

function updateChase(gameState, play, gankers, target) {
  for (const ganker of gankers) {
    ganker.targetPosition = target.position;
    ganker.activeAction.statusText = `${play.label} (${secondsToReach(ganker, target.position)}s)`;
    noteIfSpotted(gameState, play, ganker, target);
  }
  if (nearestDistance(gankers, target) <= ENGAGE_RANGE) {
    engage(gameState, play, gankers, target, gankers);
  }
}

function moveGankersToAmbush(gameState, play, gankers, target) {
  for (const ganker of gankers) {
    ganker.targetPosition = play.ambushPoint;
    const isWaiting = play.phase === PHASE.WAITING;
    const spottedSuffix = play.wasSpotted ? ' · spotted' : '';
    ganker.activeAction.statusText = isWaiting
      ? `${play.label} · waiting in ambush${spottedSuffix}`
      : `${play.label} · moving in (${secondsToReach(ganker, play.ambushPoint)}s)${spottedSuffix}`;
    noteIfSpotted(gameState, play, ganker, target);
  }
}

function noteIfSpotted(gameState, play, ganker, target) {
  if (play.wasSpotted || distanceBetween(ganker.position, target.position) <= SPOTTED_CHECK_MIN_DISTANCE) {
    return;
  }
  if (!isPositionVisible(ganker.position, teamVisionSources(gameState, opposingTeam(play.team)))) {
    return;
  }
  play.wasSpotted = true;
  target.cautiousUntilSeconds = gameState.gameSeconds + SPOTTED_REACTION_SECONDS;
  if (play.team === gameState.playerSide || target.team === gameState.playerSide) {
    addEvent(gameState, {
      kind: EVENT_KIND.CALL,
      team: play.team,
      text: `${ganker.champion.name} was spotted on the way, ${target.champion.name} backs off`,
    });
  }
}

function updateOwnerStatus(gameState, play, owners, target) {
  for (const owner of owners) {
    if (play.plan === PLAY_PLAN.BAIT) {
      owner.activeAction.statusText = `Baiting ${target.champion.name}`;
    } else if (play.plan === PLAY_PLAN.DIVE) {
      owner.activeAction.statusText = isWaveAtEnemyTower(gameState, play) ? 'Wave is in, ready to dive' : 'Shoving for the dive';
    } else {
      owner.activeAction.statusText = `Holding for ${play.label}`;
    }
  }
}

function isTriggerMet(gameState, play, initiators, target) {
  if (play.plan === PLAY_PLAN.DIVE) {
    return isWaveAtEnemyTower(gameState, play)
      && isNearStandingTower(gameState, target)
      && nearestDistance(initiators, target) <= DIVE_ENGAGE_RANGE;
  }
  return nearestDistance(initiators, target) <= ENGAGE_RANGE;
}

function engage(gameState, play, attackers, target, initiators) {
  const initiator = initiators.reduce((closest, attacker) => (
    distanceBetween(attacker.position, target.position) < distanceBetween(closest.position, target.position) ? attacker : closest
  ));
  const fight = gatherFight(gameState, { initiator, primaryTarget: target });
  for (const attacker of attackers) {
    if (!fight.attackers.includes(attacker) && distanceBetween(attacker.position, target.position) <= PLAY_JOIN_RANGE) {
      fight.attackers.push(attacker);
    }
  }
  const { chance, modifiers } = computeFightChance(gameState, fight, { wasSpotted: play.wasSpotted });
  // The random draw always happens, so a scripted outcome doesn't shift later random numbers.
  const roll = gameState.random();
  const isCaught = takeScriptedRoll(gameState, SCRIPTED_ROLL.PLAY_CATCH) ?? roll < chance;
  if (isCaught) {
    target.rootedUntilSeconds = gameState.gameSeconds + CATCH_ROOT_BASE_SECONDS
      + initiator.champion.ratings.gank * CATCH_ROOT_PER_GANK_RATING;
  }
  finishPlay(gameState, play.id);
  startTeamfight(gameState, target.position, {
    label: play.label,
    team: play.team,
    catchChance: chance,
    modifiers,
    fleeingTargetId: isCaught ? null : target.id,
    joiners: [...fight.attackers, ...fight.defenders],
  });
  const verdict = isCaught ? `${target.champion.name} is caught` : `${target.champion.name} dodges and runs`;
  addEvent(gameState, {
    kind: EVENT_KIND.FIGHT,
    team: play.team,
    text: `${play.label}: ${initiator.champion.name} goes in, ${verdict} (${Math.round(chance * PERCENT)}%)${describeTopModifiers(modifiers)}`,
  });
}

function choosePlan(gameState, { lane, team, gankers, isDiveCall }) {
  if (!lane) {
    return PLAY_PLAN.CHASE;
  }
  if (isDiveCall || gankers.length === 0) {
    return PLAY_PLAN.DIVE;
  }
  const laneState = gameState.lanes.find(candidate => candidate.lane === lane);
  return lanePushFor(gameState, laneState, team) >= DIVE_PUSH_THRESHOLD ? PLAY_PLAN.DIVE : PLAY_PLAN.BAIT;
}

function updateAmbushPoint(gameState, play, gankers) {
  if (play.ambushPoint && gameState.gameSeconds < play.nextAmbushUpdateSeconds) {
    return;
  }
  play.nextAmbushUpdateSeconds = gameState.gameSeconds + AMBUSH_UPDATE_SECONDS;
  const laneState = gameState.lanes.find(candidate => candidate.lane === play.lane);
  const offsetTowardEnemy = play.plan === PLAY_PLAN.DIVE ? AMBUSH_DIVE_DISTANCE : AMBUSH_BEHIND_WAVE_DISTANCE;
  const ambushLaneDistance = laneState.frontDistance + offsetTowardEnemy * directionTowardEnemy(play.team);
  const lanePoint = pointAtLaneDistance(play.lane, ambushLaneDistance);
  if (gankers.length === 0) {
    play.ambushPoint = lanePoint;
    return;
  }
  const before = pointAtLaneDistance(play.lane, ambushLaneDistance - LANE_TANGENT_SAMPLE);
  const after = pointAtLaneDistance(play.lane, ambushLaneDistance + LANE_TANGENT_SAMPLE);
  const tangentLength = Math.hypot(after.x - before.x, after.y - before.y) || 1;
  const perpendicular = { x: -(after.y - before.y) / tangentLength, y: (after.x - before.x) / tangentLength };
  const sides = [1, -1].map(sign => nearestWalkable({
    x: lanePoint.x + perpendicular.x * AMBUSH_SIDE_OFFSET * sign,
    y: lanePoint.y + perpendicular.y * AMBUSH_SIDE_OFFSET * sign,
  }));
  const approachFrom = gankers[0].position;
  play.ambushPoint = sides.reduce((best, side) => (distanceBetween(side, approachFrom) < distanceBetween(best, approachFrom) ? side : best));
}

function isWaveAtEnemyTower(gameState, play) {
  const laneState = gameState.lanes.find(candidate => candidate.lane === play.lane);
  const { blueLimit, redLimit } = waveFrontLimits(gameState, laneState);
  const isAtLimit = directionTowardEnemy(play.team) > 0
    ? laneState.frontDistance >= redLimit - AT_LIMIT_TOLERANCE
    : laneState.frontDistance <= blueLimit + AT_LIMIT_TOLERANCE;
  return isAtLimit && laneState.minions[play.team] > 0;
}

function isNearStandingTower(gameState, championState) {
  return gameState.teams[championState.team].structures.some(structure => structure.type === STRUCTURE_TYPE.TOWER
    && structure.isStanding && distanceBetween(structure, championState.position) <= UNDER_TOWER_RANGE * 2);
}

function laneOwnersFor(gameState, team, lane, gankers, extraOwners) {
  if (!lane) {
    return extraOwners;
  }
  const owners = gameState.teams[team].champions.filter(championState => LANE_BY_ROLE[championState.role] === lane
    && !gankers.includes(championState)
    && championState.isAlive
    && championState.activity !== ACTIVITY.IN_FOUNTAIN
    && championState.activity !== ACTIVITY.RECALLING);
  return [...new Set([...owners, ...extraOwners])];
}

function participantsOf(gameState, play, ids) {
  return ids.map(id => championById(gameState, id))
    .filter(championState => championState.isAlive && championState.activeAction?.playId === play.id);
}

function describePlan(play, gankers, owners, target) {
  const gankerNames = gankers.map(ganker => ganker.champion.name).join(' and ');
  const ownerNames = owners.map(owner => owner.champion.name).join(' and ');
  if (play.plan === PLAY_PLAN.BAIT) {
    return `${ownerNames || 'the lane'} plays safe to bait ${target.champion.name}, ${gankerNames} comes in from the side`;
  }
  if (play.plan === PLAY_PLAN.DIVE) {
    return gankerNames
      ? `${ownerNames} shoves the wave in, ${gankerNames} waits by the tower to dive`
      : `${ownerNames} shoves the wave in and dives when it hits the tower`;
  }
  return `${gankerNames} goes after ${target.champion.name}`;
}

function secondsToReach(championState, destination) {
  return Math.ceil(distanceBetween(championState.position, destination) / CHAMPION_MOVE_SPEED);
}

function nearestDistance(championStates, target) {
  return Math.min(...championStates.map(championState => distanceBetween(championState.position, target.position)));
}

function championById(gameState, championId) {
  return allChampionStates(gameState).find(candidate => candidate.id === championId);
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
