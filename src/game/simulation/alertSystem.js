import { opposingTeam } from '../../config/teams.js';
import { ROLE } from '../../config/roles.js';
import { OBJECTIVE_LABELS } from '../../config/objectiveRules.js';
import { STRUCTURE_TYPE } from '../mapLayout.js';
import { upcomingObjectiveTimers } from '../objectives.js';
import { describeStructure } from '../structures.js';
import { isPositionVisible, teamVisionSources } from '../vision.js';
import { describeArea } from '../areas.js';

const OBJECTIVE_WARNING_SECONDS = 30;
const JUNGLER_MISSING_BEFORE_ALERT_SECONDS = 30;
const TOWER_FALLING_HEALTH = 0.3;
const ENEMIES_ON_OBJECTIVE_FOR_ALERT = 3;
const OBJECTIVE_THREAT_RANGE = 250;
const MIN_SECONDS_BETWEEN_FIGHT_ALERTS = 20;
const MIN_SECONDS_BETWEEN_JUNGLER_ALERTS = 45;
const MAJOR_FIGHT_PARTICIPANTS = 4;

export function updateAlerts(gameState) {
  gameState.alertMemory ??= {
    warnedObjectiveSpawns: new Set(),
    warnedFightIds: new Set(),
    warnedStructures: new Set(),
    warnedEnemyOnObjective: new Set(),
    lastSeenEnemyJunglerSeconds: null,
    lastFightAlertSeconds: -Infinity,
    lastJunglerAlertSeconds: -Infinity,
  };
  const memory = gameState.alertMemory;
  warnAboutObjectiveSpawns(gameState, memory);
  warnAboutEnemyJungler(gameState, memory);
  warnAboutFights(gameState, memory);
  warnAboutFallingTowers(gameState, memory);
  warnAboutEnemyOnObjective(gameState, memory);
}

function warnAboutObjectiveSpawns(gameState, memory) {
  for (const { objective, secondsUntilSpawn } of upcomingObjectiveTimers(gameState)) {
    const spawnKey = `${objective.key}:${objective.spawnAtSeconds}`;
    if (!objective.isAlive && secondsUntilSpawn <= OBJECTIVE_WARNING_SECONDS && !memory.warnedObjectiveSpawns.has(spawnKey)) {
      memory.warnedObjectiveSpawns.add(spawnKey);
      raiseAlert(gameState, `${OBJECTIVE_LABELS[objective.key]} spawns in ${Math.ceil(secondsUntilSpawn)}s`);
    }
  }
}

function warnAboutEnemyJungler(gameState, memory) {
  const enemyJungler = gameState.teams[opposingTeam(gameState.playerSide)].champions.find(enemy => enemy.role === ROLE.JUNGLE);
  const isVisible = enemyJungler.isAlive && isPositionVisible(enemyJungler.position, teamVisionSources(gameState, gameState.playerSide));
  if (!isVisible) {
    return;
  }
  const wasMissing = memory.lastSeenEnemyJunglerSeconds === null
    || gameState.gameSeconds - memory.lastSeenEnemyJunglerSeconds >= JUNGLER_MISSING_BEFORE_ALERT_SECONDS;
  memory.lastSeenEnemyJunglerSeconds = gameState.gameSeconds;
  const isAlertDue = gameState.gameSeconds - memory.lastJunglerAlertSeconds >= MIN_SECONDS_BETWEEN_JUNGLER_ALERTS;
  if (wasMissing && isAlertDue) {
    memory.lastJunglerAlertSeconds = gameState.gameSeconds;
    raiseAlert(gameState, `${enemyJungler.champion.name} spotted ${describeArea(enemyJungler.position, gameState.playerSide)}`);
  }
}

function warnAboutFights(gameState, memory) {
  for (const fight of gameState.fights) {
    const involvesPlayer = gameState.teams[gameState.playerSide].champions.some(championState => championState.inFightId === fight.id);
    if (!fight.hadBothSides || !involvesPlayer || memory.warnedFightIds.has(fight.id)) {
      continue;
    }
    memory.warnedFightIds.add(fight.id);
    if (gameState.gameSeconds - memory.lastFightAlertSeconds >= MIN_SECONDS_BETWEEN_FIGHT_ALERTS) {
      memory.lastFightAlertSeconds = gameState.gameSeconds;
      const isMajor = fight.peakParticipants >= MAJOR_FIGHT_PARTICIPANTS;
      raiseAlert(gameState, `Fight ${describeArea(fight.location, gameState.playerSide)}!`, isMajor);
    }
  }
}

function warnAboutFallingTowers(gameState, memory) {
  const playerStructures = gameState.teams[gameState.playerSide].structures;
  playerStructures.forEach((structure, index) => {
    const isFalling = structure.type === STRUCTURE_TYPE.TOWER && structure.isStanding && structure.healthRatio < TOWER_FALLING_HEALTH;
    if (isFalling && !memory.warnedStructures.has(index)) {
      memory.warnedStructures.add(index);
      raiseAlert(gameState, `Your ${describeStructure(structure)} is falling`);
    }
  });
}

function warnAboutEnemyOnObjective(gameState, memory) {
  const playerVision = teamVisionSources(gameState, gameState.playerSide);
  const enemies = gameState.teams[opposingTeam(gameState.playerSide)].champions;
  for (const objective of Object.values(gameState.objectives).filter(candidate => candidate.isAlive)) {
    const spawnKey = `${objective.key}:${objective.spawnAtSeconds}`;
    const enemiesAtPit = enemies.filter(enemy => enemy.isAlive
      && Math.hypot(enemy.position.x - objective.pit.x, enemy.position.y - objective.pit.y) <= OBJECTIVE_THREAT_RANGE
      && isPositionVisible(enemy.position, playerVision));
    if (enemiesAtPit.length >= ENEMIES_ON_OBJECTIVE_FOR_ALERT && !memory.warnedEnemyOnObjective.has(spawnKey)) {
      memory.warnedEnemyOnObjective.add(spawnKey);
      raiseAlert(gameState, `Enemies are on ${OBJECTIVE_LABELS[objective.key]}!`, true);
    }
  }
}

function raiseAlert(gameState, text, isMajor = false) {
  gameState.alerts.push({ text, isMajor, gameSeconds: gameState.gameSeconds });
}
