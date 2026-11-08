import { BARON_PUSH_MULTIPLIER } from '../../config/objectiveRules.js';
import {
  CASTER_MINIONS_PER_WAVE, FRONT_GROUP_RANGE, FRONT_MAX_SPEED, MAX_MINIONS_PER_TEAM_IN_LANE, MELEE_MINIONS_PER_WAVE, MINION_DAMAGE_JITTER,
  MINION_KIND, MINION_SPAWN_INTERVAL_SECONDS, MINION_STATS, MINION_WALK_SPEED, TOWER_MINION_RANGE, TOWER_SHOTS_PER_SECOND, waveRulesAt,
} from '../../config/minionRules.js';
import { TEAM, opposingTeam } from '../../config/teams.js';
import { directionTowardEnemy, laneLength } from '../laneGeometry.js';
import { STRUCTURE_TYPE } from '../mapLayout.js';
import { frontStructureOf, isInhibitorDown, laneDistanceOfStructure } from '../structures.js';
import { hasBaron } from '../teamPower.js';

const TEAMS = Object.freeze([TEAM.BLUE, TEAM.RED]);
const LANES_WITH_INHIBITORS = Object.freeze(['top', 'mid', 'bot']);
const ONE_SUPER_MINION = 1;
const TWO_SUPER_MINIONS = 2;

// Each minion is a small record on its lane: a team, a kind, its place along the lane and its
// health. A lane's minions are simple on purpose: they walk straight along the lane, stop when
// something is in range and hit the nearest enemy, with no collisions or other tactics.

export function spawnDueMinions(gameState, laneState) {
  if (gameState.gameSeconds >= laneState.nextWaveSeconds) {
    queueWave(gameState, laneState);
  }
  const dueSpawns = laneState.spawnQueue.filter(spawn => spawn.spawnsAtSeconds <= gameState.gameSeconds);
  if (dueSpawns.length > 0) {
    laneState.spawnQueue = laneState.spawnQueue.filter(spawn => spawn.spawnsAtSeconds > gameState.gameSeconds);
    dueSpawns.forEach(spawn => laneState.minionList.push(createMinion(gameState, laneState, spawn)));
  }
}

function queueWave(gameState, laneState) {
  const { gameSeconds } = gameState;
  const { intervalSeconds, cannonEvery } = waveRulesAt(gameSeconds);
  laneState.wavesSpawned += 1;
  for (const team of TEAMS) {
    const hasCannon = laneState.wavesSpawned % cannonEvery === 0;
    waveLineup(gameState, { laneState, team, hasCannon }).forEach((kind, lineupIndex) => {
      laneState.spawnQueue.push({ team, kind, waveNumber: laneState.wavesSpawned, spawnsAtSeconds: gameSeconds + lineupIndex * MINION_SPAWN_INTERVAL_SECONDS });
    });
  }
  laneState.nextWaveSeconds += intervalSeconds;
}

// Walking order: super minions and melee in front, then the cannon, casters last. A super minion
// takes the cannon's place in the wave.
function waveLineup(gameState, { laneState, team, hasCannon }) {
  const superCount = superMinionCount(gameState, opposingTeam(team), laneState.lane);
  const lineup = [
    ...Array(superCount).fill(MINION_KIND.SUPER),
    ...Array(MELEE_MINIONS_PER_WAVE).fill(MINION_KIND.MELEE),
    ...(hasCannon && superCount === 0 ? [MINION_KIND.CANNON] : []),
    ...Array(CASTER_MINIONS_PER_WAVE).fill(MINION_KIND.CASTER),
  ];
  const aliveCount = laneState.minionList.filter(minion => minion.team === team).length;
  return lineup.slice(0, Math.max(0, MAX_MINIONS_PER_TEAM_IN_LANE - aliveCount));
}

function superMinionCount(gameState, defendingTeam, lane) {
  if (!isInhibitorDown(gameState, defendingTeam, lane)) {
    return 0;
  }
  const isEveryInhibitorDown = LANES_WITH_INHIBITORS.every(candidate => isInhibitorDown(gameState, defendingTeam, candidate));
  return isEveryInhibitorDown ? TWO_SUPER_MINIONS : ONE_SUPER_MINION;
}

function createMinion(gameState, laneState, { team, kind, waveNumber }) {
  const startDistance = team === TEAM.BLUE ? 0 : laneLength(laneState.lane);
  const minion = {
    id: laneState.nextMinionId,
    team,
    kind,
    waveNumber,
    laneDistance: startDistance,
    previousDistance: startDistance,
    health: MINION_STATS[kind].health,
    wasLastHitTried: false,
    wasLastHit: false,
    pendingDamage: 0,
    damageFactor: 1 + (gameState.laneRandom() * 2 - 1) * MINION_DAMAGE_JITTER,
  };
  laneState.nextMinionId += 1;
  return minion;
}

// A minion with an enemy in range stands and hits it, otherwise it walks on. Damage is collected
// first and applied together, so the order of the list does not decide who dies first.
export function updateMinionCombat(gameState, laneState, { limits, tickSeconds }) {
  for (const minion of laneState.minionList) {
    minion.previousDistance = minion.laneDistance;
    const target = nearestEnemyInRange(laneState, minion);
    if (target) {
      target.pendingDamage += damagePerSecondOf(gameState, minion) * tickSeconds;
    } else {
      walk(minion, { limits, tickSeconds });
    }
  }
  for (const minion of laneState.minionList) {
    minion.health -= minion.pendingDamage;
    minion.pendingDamage = 0;
  }
}

function nearestEnemyInRange(laneState, minion) {
  let nearest = null;
  let nearestDistance = MINION_STATS[minion.kind].range;
  for (const other of laneState.minionList) {
    const distance = Math.abs(other.laneDistance - minion.laneDistance);
    if (other.team !== minion.team && distance <= nearestDistance) {
      nearest = other;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function damagePerSecondOf(gameState, minion) {
  const baronFactor = hasBaron(gameState, minion.team) ? BARON_PUSH_MULTIPLIER : 1;
  return MINION_STATS[minion.kind].damagePerSecond * minion.damageFactor * baronFactor;
}

// Stops at the enemy's front structure. A minion already past that point (an inhibitor came back
// behind it) just waits there instead of jumping back.
function walk(minion, { limits, tickSeconds }) {
  const direction = directionTowardEnemy(minion.team);
  const walkLimit = minion.team === TEAM.BLUE ? limits.redLimit : limits.blueLimit;
  const stopDistance = walkLimit - direction * MINION_STATS[minion.kind].formationBack;
  const distanceLeft = (stopDistance - minion.laneDistance) * direction;
  if (distanceLeft > 0) {
    minion.laneDistance += direction * Math.min(distanceLeft, MINION_WALK_SPEED * tickSeconds);
  }
}

// A tower shot takes a fixed share of a minion's health, so a cannon lasts far longer than a caster.
export function shootMinionsFromTowers(gameState, laneState, tickSeconds) {
  for (const team of TEAMS) {
    laneState.towerShotCooldowns[team] = Math.max(0, laneState.towerShotCooldowns[team] - tickSeconds);
    const tower = laneState.towerShotCooldowns[team] === 0 ? frontStructureOf(gameState, team, laneState.lane) : null;
    if (tower?.type === STRUCTURE_TYPE.TOWER) {
      shootNearestAttacker(laneState, { team, tower });
    }
  }
}

function shootNearestAttacker(laneState, { team, tower }) {
  const towerDistance = laneDistanceOfStructure(tower, laneState.lane);
  const distanceToTower = minion => Math.abs(minion.laneDistance - towerDistance);
  const target = laneState.minionList
    .filter(minion => minion.team !== team && distanceToTower(minion) <= TOWER_MINION_RANGE)
    .reduce((nearest, minion) => (!nearest || distanceToTower(minion) < distanceToTower(nearest) ? minion : nearest), null);
  if (target) {
    const { health, towerShotsToKill } = MINION_STATS[target.kind];
    target.health -= health / towerShotsToKill;
    laneState.towerShotCooldowns[team] = 1 / TOWER_SHOTS_PER_SECOND;
  }
}

// The minion a champion at the front goes for: the enemy near the front with the least health left.
export function lowestHealthEnemyAtFront(laneState, team) {
  let lowest = null;
  for (const minion of laneState.minionList) {
    const isCandidate = minion.team !== team && minion.health > 0 && Math.abs(minion.laneDistance - laneState.frontDistance) <= FRONT_GROUP_RANGE;
    if (isCandidate && (!lowest || minion.health < lowest.health)) {
      lowest = minion;
    }
  }
  return lowest;
}

export function removeDeadMinions(laneState) {
  const deadMinions = laneState.minionList.filter(minion => minion.health <= 0);
  if (deadMinions.length > 0) {
    laneState.minionList = laneState.minionList.filter(minion => minion.health > 0);
  }
  return deadMinions;
}

// The front is where the two waves meet, or where the lead minion is when only one team has any.
// It moves at a limited speed, so champions don't jump when a wave dies and the next is far away.
export function updateWaveFront(laneState, { limits, tickSeconds }) {
  const targetDistance = Math.min(limits.redLimit, Math.max(limits.blueLimit, frontTargetOf(laneState)));
  const maxStep = FRONT_MAX_SPEED * tickSeconds;
  const step = Math.min(maxStep, Math.max(-maxStep, targetDistance - laneState.frontDistance));
  laneState.frontDistance += step;
  for (const team of TEAMS) {
    laneState.minions[team] = laneState.minionList
      .filter(minion => minion.team === team && Math.abs(minion.laneDistance - laneState.frontDistance) <= FRONT_GROUP_RANGE)
      .length;
  }
}

function frontTargetOf(laneState) {
  const blueLead = leadDistanceOf(laneState, TEAM.BLUE);
  const redLead = leadDistanceOf(laneState, TEAM.RED);
  if (blueLead !== null && redLead !== null) {
    return (blueLead + redLead) / 2;
  }
  return blueLead ?? redLead ?? laneState.frontDistance;
}

function leadDistanceOf(laneState, team) {
  const direction = directionTowardEnemy(team);
  let lead = null;
  for (const minion of laneState.minionList) {
    if (minion.team === team && (lead === null || (minion.laneDistance - lead) * direction > 0)) {
      lead = minion.laneDistance;
    }
  }
  return lead;
}

// One point per wave, at its lead minion: minions give vision wherever they walk, and one source
// per wave keeps vision cheap to work out.
export function waveLeadDistances(laneState, team) {
  const direction = directionTowardEnemy(team);
  const leadByWave = new Map();
  for (const minion of laneState.minionList.filter(candidate => candidate.team === team)) {
    const lead = leadByWave.get(minion.waveNumber);
    if (lead === undefined || (minion.laneDistance - lead) * direction > 0) {
      leadByWave.set(minion.waveNumber, minion.laneDistance);
    }
  }
  return [...leadByWave.values()];
}
