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
import { allChampionStates, championById, laneStateFor, laneStateOf } from '../gameState.js';
import { LANE_BY_ROLE, STRUCTURE_TYPE } from '../mapLayout.js';
import { pointAtLaneDistance } from '../laneGeometry.js';
import { nearestWalkable } from '../navigation.js';
import { SCRIPTED_ROLL, takeScriptedRoll } from '../random.js';
import { isPositionVisible, teamVisionSources } from '../vision.js';
import { computeFightChance, describeTopModifiers, gatherFight } from './fightSystem.js';
import { directionTowardEnemy, lanePushFor, waveFrontLimits } from './laneSystem.js';
import { startTeamfight } from './teamfightSystem.js';
import { distanceBetween } from '../geometry.js';

const PERCENT = 100;
const AT_LIMIT_TOLERANCE = 1;

const PHASE = Object.freeze({ PREPARE: 'prepare', SETUP: 'setup', WAITING: 'waiting' });
const LANER_ROLES = Object.freeze([ROLE.TOP, ROLE.MID, ROLE.BOT]);

// A play is a gank, roam or dive with a setup: gankers move to an ambush beside the lane while
// the lane's own champions (owners) bait or shove, and the fight starts when the trigger is met.
export function startPlay(gameState, { gankers, target, label, isDiveCall = false, extraOwners = [] }) {
  const team = gankers[0]?.team ?? extraOwners[0].team;
  const lane = target.role === ROLE.JUNGLE ? null : LANE_BY_ROLE[target.role];
  const owners = laneOwnersFor(gameState, { team, lane, gankers, extraOwners });
  const play = createPlay(gameState, { team, lane, label, gankers, owners, target, isDiveCall });
  gameState.plays.push(play);
  giveGankersTheirOrders(play, gankers);
  giveOwnersTheirOrders(play, owners);
  if (team === gameState.playerSide) {
    addEvent(gameState, { kind: EVENT_KIND.CALL, team, text: `${label}: ${describePlan(play, gankers, owners, target)}` });
  }
  return play;
}

function createPlay(gameState, { team, lane, label, gankers, owners, target, isDiveCall }) {
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
  return play;
}

function giveGankersTheirOrders(play, gankers) {
  for (const ganker of gankers) {
    if (play.phase === PHASE.PREPARE && isLanerWhoShouldShoveFirst(ganker)) {
      const statusText = `${play.label} · shoving first`;
      ganker.activeAction = { kind: ACTION_KIND.PLAY_SETUP, playId: play.id, stance: SHOVE_STANCE, label: play.label, statusText };
    } else {
      sendGankerOut(ganker, play);
    }
  }
}

function giveOwnersTheirOrders(play, owners) {
  for (const owner of owners) {
    owner.activeAction = { kind: ACTION_KIND.PLAY_SETUP, playId: play.id, plan: play.plan, label: play.label, statusText: play.label };
  }
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
  const participants = {
    target: championById(gameState, play.targetId),
    gankers: participantsOf(gameState, play, play.gankerIds),
    owners: participantsOf(gameState, play, play.ownerIds),
  };
  const callOffText = callOffTextFor(gameState, play, participants);
  if (callOffText) {
    finishPlay(gameState, play.id, callOffText);
    return;
  }
  updateOwnerStatus(gameState, play, participants);
  if (play.phase === PHASE.PREPARE) {
    updatePreparation(gameState, play, participants.gankers);
  } else if (play.plan === PLAY_PLAN.CHASE) {
    updateChase(gameState, play, participants);
  } else {
    updateAmbush(gameState, play, participants);
  }
}

// Why the play has to stop now, or null while it can go on.
function callOffTextFor(gameState, play, { target, gankers, owners }) {
  if (!target.isAlive || target.activity === ACTIVITY.IN_FOUNTAIN) {
    return `${play.label} called off: ${target.champion.name} left`;
  }
  const attackersLeft = play.plan === PLAY_PLAN.DIVE ? gankers.length + owners.length : gankers.length;
  if (attackersLeft === 0) {
    return `${play.label} called off`;
  }
  if (gameState.gameSeconds - play.startedAtSeconds > PLAY_MAX_SECONDS) {
    return `${play.label} called off: took too long`;
  }
  return null;
}

function updateAmbush(gameState, play, participants) {
  const { gankers } = participants;
  updateAmbushPoint(gameState, play, gankers);
  moveGankersToAmbush(gameState, play, participants);
  if (play.phase === PHASE.SETUP && gankers.every(ganker => distanceBetween(ganker.position, play.ambushPoint) <= AMBUSH_ARRIVAL_DISTANCE)) {
    play.phase = PHASE.WAITING;
    play.phaseStartedAtSeconds = gameState.gameSeconds;
  }
  if (play.phase === PHASE.WAITING) {
    updateWaitingAmbush(gameState, play, participants);
  }
}

// In ambush: go in when the trigger is met. After waiting too long, go in anyway if the target
// is close enough, otherwise give up.
function updateWaitingAmbush(gameState, play, { target, gankers, owners }) {
  const attack = { target, attackers: [...gankers, ...owners], initiators: gankers.length > 0 ? gankers : owners };
  if (isTriggerMet(gameState, play, attack)) {
    engage(gameState, play, attack);
    return;
  }
  if (gameState.gameSeconds - play.phaseStartedAtSeconds <= PLAY_WAIT_MAX_SECONDS) {
    return;
  }
  if (nearestDistance(attack.initiators, target) <= FORCE_ENGAGE_RANGE) {
    engage(gameState, play, attack);
  } else {
    finishPlay(gameState, play.id, `${play.label} called off: ${target.champion.name} never came close`);
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
    const laneState = laneStateOf(gameState, ganker);
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

function updateChase(gameState, play, { target, gankers }) {
  for (const ganker of gankers) {
    ganker.targetPosition = target.position;
    ganker.activeAction.statusText = `${play.label} (${secondsToReach(ganker, target.position)}s)`;
    noteIfSpotted(gameState, play, ganker, target);
  }
  if (nearestDistance(gankers, target) <= ENGAGE_RANGE) {
    engage(gameState, play, { target, attackers: gankers, initiators: gankers });
  }
}

function moveGankersToAmbush(gameState, play, { target, gankers }) {
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

function updateOwnerStatus(gameState, play, { owners, target }) {
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

function isTriggerMet(gameState, play, { initiators, target }) {
  if (play.plan === PLAY_PLAN.DIVE) {
    return isWaveAtEnemyTower(gameState, play)
      && isNearStandingTower(gameState, target)
      && nearestDistance(initiators, target) <= DIVE_ENGAGE_RANGE;
  }
  return nearestDistance(initiators, target) <= ENGAGE_RANGE;
}

// The closest initiator goes in. Whether the target is caught is a roll against the fight chance;
// either way the play turns into a teamfight around the target.
function engage(gameState, play, { target, attackers, initiators }) {
  const initiator = closestTo(target.position, initiators);
  const fight = gatherFight(gameState, { initiator, primaryTarget: target });
  addNearbyAttackers(fight, attackers, target);
  const { chance, modifiers } = computeFightChance(gameState, fight, { wasSpotted: play.wasSpotted });
  const isCaught = rollCatch(gameState, chance);
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
  announceEngage(gameState, play, { initiator, target, isCaught, chance, modifiers });
}

function closestTo(position, championStates) {
  return championStates.reduce((closest, championState) => (
    distanceBetween(championState.position, position) < distanceBetween(closest.position, position) ? championState : closest
  ));
}

function addNearbyAttackers(fight, attackers, target) {
  for (const attacker of attackers) {
    if (!fight.attackers.includes(attacker) && distanceBetween(attacker.position, target.position) <= PLAY_JOIN_RANGE) {
      fight.attackers.push(attacker);
    }
  }
}

// The random draw always happens, so a scripted outcome doesn't shift later random numbers.
function rollCatch(gameState, chance) {
  const roll = gameState.random();
  return takeScriptedRoll(gameState, SCRIPTED_ROLL.PLAY_CATCH) ?? roll < chance;
}

function announceEngage(gameState, play, { initiator, target, isCaught, chance, modifiers }) {
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
  const laneState = laneStateFor(gameState, lane);
  return lanePushFor(gameState, laneState, team) >= DIVE_PUSH_THRESHOLD ? PLAY_PLAN.DIVE : PLAY_PLAN.BAIT;
}

// The ambush follows the wave: just behind it for a gank, at the enemy tower for a dive.
// It is refreshed now and then rather than every tick, so gankers don't jitter.
function updateAmbushPoint(gameState, play, gankers) {
  if (play.ambushPoint && gameState.gameSeconds < play.nextAmbushUpdateSeconds) {
    return;
  }
  play.nextAmbushUpdateSeconds = gameState.gameSeconds + AMBUSH_UPDATE_SECONDS;
  const laneState = laneStateFor(gameState, play.lane);
  const offsetTowardEnemy = play.plan === PLAY_PLAN.DIVE ? AMBUSH_DIVE_DISTANCE : AMBUSH_BEHIND_WAVE_DISTANCE;
  const ambushLaneDistance = laneState.frontDistance + offsetTowardEnemy * directionTowardEnemy(play.team);
  play.ambushPoint = gankers.length === 0
    ? pointAtLaneDistance(play.lane, ambushLaneDistance)
    : besideLaneNearest(play.lane, ambushLaneDistance, gankers[0].position);
}

// Gankers wait beside the lane, not on it, on whichever side they are coming from.
function besideLaneNearest(lane, laneDistance, approachFrom) {
  const lanePoint = pointAtLaneDistance(lane, laneDistance);
  const perpendicular = lanePerpendicularAt(lane, laneDistance);
  const sides = [1, -1].map(sign => nearestWalkable({
    x: lanePoint.x + perpendicular.x * AMBUSH_SIDE_OFFSET * sign,
    y: lanePoint.y + perpendicular.y * AMBUSH_SIDE_OFFSET * sign,
  }));
  return sides.reduce((best, side) => (distanceBetween(side, approachFrom) < distanceBetween(best, approachFrom) ? side : best));
}

function lanePerpendicularAt(lane, laneDistance) {
  const before = pointAtLaneDistance(lane, laneDistance - LANE_TANGENT_SAMPLE);
  const after = pointAtLaneDistance(lane, laneDistance + LANE_TANGENT_SAMPLE);
  const tangentLength = Math.hypot(after.x - before.x, after.y - before.y) || 1;
  return { x: -(after.y - before.y) / tangentLength, y: (after.x - before.x) / tangentLength };
}

function isWaveAtEnemyTower(gameState, play) {
  const laneState = laneStateFor(gameState, play.lane);
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

// The champions who play the target's lane (plus any extra owners) bait or shove for the play.
function laneOwnersFor(gameState, { team, lane, gankers, extraOwners }) {
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
