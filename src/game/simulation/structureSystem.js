import { TEAM, TEAM_LABELS, opposingTeam } from '../../config/teams.js';
import {
  AT_STRUCTURE_TOLERANCE, CHAMPION_SIEGE_DAMAGE_PER_LEVEL, CHAMPION_SIEGE_DAMAGE_PER_SECOND, INHIBITOR_RESPAWN_SECONDS,
  MINION_SIEGE_DAMAGE_PER_SECOND, OUTER_TOWER_PLATES, PLATE_GOLD, PLATED_DAMAGE_MULTIPLIER, PLATES_FALL_SECONDS, SIEGE_RANGE,
  STRUCTURE_DAMAGE_TAKEN_MULTIPLIER, TOWER_LOCAL_GOLD, TOWER_TEAM_GOLD,
} from '../../config/structureRules.js';
import { BARON_SIEGE_MULTIPLIER, VOID_GRUB_SIEGE_BONUS_PER_STACK } from '../../config/objectiveRules.js';
import { ACTIVITY } from '../activities.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { STRUCTURE_TYPE } from '../mapLayout.js';
import { describeStructure, frontStructureOf } from '../structures.js';
import { hasBaron } from '../teamPower.js';
import { waveFrontLimits, waveFrontPosition } from './laneSystem.js';
import { grantGold } from './economy.js';

export function updateStructures(gameState, tickSeconds) {
  dropPlatesWhenTimeIsUp(gameState);
  respawnInhibitors(gameState);
  for (const laneState of gameState.lanes) {
    for (const attackingTeam of [TEAM.BLUE, TEAM.RED]) {
      siegeLane(gameState, laneState, attackingTeam, tickSeconds);
    }
  }
}

export function damageStructure(gameState, structure, damage, attackingTeam, nearbyAttackers) {
  const platingMultiplier = structure.platesLeft > 0 ? PLATED_DAMAGE_MULTIPLIER : 1;
  const damageMultiplier = STRUCTURE_DAMAGE_TAKEN_MULTIPLIER[structure.tier] * platingMultiplier;
  structure.healthRatio = Math.max(0, structure.healthRatio - damage * damageMultiplier);
  while (structure.platesLeft > 0 && structure.healthRatio <= (structure.platesLeft - 1) / OUTER_TOWER_PLATES) {
    structure.platesLeft -= 1;
    splitGold(nearbyAttackers, PLATE_GOLD);
  }
  if (structure.healthRatio <= 0) {
    destroyStructure(gameState, structure, attackingTeam, nearbyAttackers);
  }
}

function siegeLane(gameState, laneState, attackingTeam, tickSeconds) {
  const target = frontStructureOf(gameState, opposingTeam(attackingTeam), laneState.lane);
  const attackingMinions = laneState.minions[attackingTeam];
  if (!target || attackingMinions <= 0 || !isWaveAtEnemyStructure(gameState, laneState, attackingTeam)) {
    return;
  }
  const siegers = siegingChampions(gameState, laneState, attackingTeam);
  const championDamage = siegers.reduce((sum, championState) => sum
    + CHAMPION_SIEGE_DAMAGE_PER_SECOND + championState.level * CHAMPION_SIEGE_DAMAGE_PER_LEVEL, 0);
  const teamState = gameState.teams[attackingTeam];
  const buffMultiplier = (1 + teamState.voidGrubs * VOID_GRUB_SIEGE_BONUS_PER_STACK)
    * (hasBaron(gameState, attackingTeam) ? BARON_SIEGE_MULTIPLIER : 1);
  const damage = (attackingMinions * MINION_SIEGE_DAMAGE_PER_SECOND + championDamage) * buffMultiplier * tickSeconds;
  damageStructure(gameState, target, damage, attackingTeam, siegers);
}

function isWaveAtEnemyStructure(gameState, laneState, attackingTeam) {
  const { blueLimit, redLimit } = waveFrontLimits(gameState, laneState);
  return attackingTeam === TEAM.BLUE
    ? laneState.frontDistance >= redLimit - AT_STRUCTURE_TOLERANCE
    : laneState.frontDistance <= blueLimit + AT_STRUCTURE_TOLERANCE;
}

function siegingChampions(gameState, laneState, team) {
  const frontPosition = waveFrontPosition(laneState);
  return gameState.teams[team].champions.filter(championState => championState.isAlive
    && !championState.inFightId
    && championState.activity !== ACTIVITY.IN_FOUNTAIN
    && Math.hypot(championState.position.x - frontPosition.x, championState.position.y - frontPosition.y) <= SIEGE_RANGE);
}

function destroyStructure(gameState, structure, attackingTeam, nearbyAttackers) {
  structure.isStanding = false;
  structure.platesLeft = 0;
  if (structure.type === STRUCTURE_TYPE.TOWER) {
    for (const championState of gameState.teams[attackingTeam].champions) {
      grantGold(championState, TOWER_TEAM_GOLD);
    }
    splitGold(nearbyAttackers, TOWER_LOCAL_GOLD);
  }
  if (structure.type === STRUCTURE_TYPE.INHIBITOR) {
    structure.respawnAtSeconds = gameState.gameSeconds + INHIBITOR_RESPAWN_SECONDS;
  }
  if (structure.type === STRUCTURE_TYPE.NEXUS) {
    gameState.winner = attackingTeam;
  }
  addEvent(gameState, {
    kind: EVENT_KIND.STRUCTURE,
    team: attackingTeam,
    text: `${TEAM_LABELS[attackingTeam]} destroyed the ${TEAM_LABELS[opposingTeam(attackingTeam)].toLowerCase()} ${describeStructure(structure)}`,
  });
}

function dropPlatesWhenTimeIsUp(gameState) {
  if (gameState.platesHaveFallen || gameState.gameSeconds < PLATES_FALL_SECONDS) {
    return;
  }
  gameState.platesHaveFallen = true;
  for (const teamState of Object.values(gameState.teams)) {
    for (const structure of teamState.structures) {
      structure.platesLeft = 0;
    }
  }
  addEvent(gameState, { kind: EVENT_KIND.STRUCTURE, team: null, text: 'Tower plates have fallen' });
}

function respawnInhibitors(gameState) {
  for (const teamState of Object.values(gameState.teams)) {
    for (const structure of teamState.structures) {
      const isDueToRespawn = structure.type === STRUCTURE_TYPE.INHIBITOR && !structure.isStanding
        && structure.respawnAtSeconds !== null && gameState.gameSeconds >= structure.respawnAtSeconds;
      if (isDueToRespawn) {
        structure.isStanding = true;
        structure.healthRatio = 1;
        structure.respawnAtSeconds = null;
        addEvent(gameState, { kind: EVENT_KIND.STRUCTURE, team: teamState.team, text: `${TEAM_LABELS[teamState.team]} ${describeStructure(structure)} respawned` });
      }
    }
  }
}

function splitGold(championStates, totalGold) {
  if (championStates.length === 0) {
    return;
  }
  for (const championState of championStates) {
    grantGold(championState, totalGold / championStates.length);
  }
}
