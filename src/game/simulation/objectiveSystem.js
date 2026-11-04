import { TEAM, TEAM_LABELS } from '../../config/teams.js';
import { ACTION_KIND } from '../../config/actions.js';
import {
  BARON_BUFF_SECONDS, BARON_GOLD_PER_CHAMPION, BARON_RESPAWN_SECONDS, DRAGON_ELEMENTS, DRAGON_RESPAWN_SECONDS,
  DRAKES_BEFORE_RIFT_ELEMENT, DRAKES_FOR_SOUL, ELDER_BUFF_SECONDS, ELDER_RESPAWN_SECONDS, ELDER_SPAWN_DELAY_AFTER_SOUL_SECONDS,
  HERALD_STRUCTURE_DAMAGE, OBJECTIVE_EFFORT, OBJECTIVE_KEY, OBJECTIVE_LABELS, OBJECTIVE_RANGE, VOID_GRUBS_COUNT,
} from '../../config/objectiveRules.js';
import { TEAMFIGHT_JOIN_RANGE } from '../../config/teamfightRules.js';
import { ACTIVITY } from '../activities.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { frontStructureOf } from '../structures.js';
import { fightPowerOf } from '../teamPower.js';
import { lanePushFor } from './laneSystem.js';
import { damageStructure } from './structureSystem.js';
import { startTeamfight } from './teamfightSystem.js';
import { grantGold } from './economy.js';

const MINIMUM_CONTESTERS_FOR_TEAMFIGHT = 1;

export function updateObjectives(gameState, tickSeconds) {
  for (const objective of Object.values(gameState.objectives)) {
    spawnOrDespawn(gameState, objective);
    if (objective.isAlive) {
      progressObjective(gameState, objective, tickSeconds);
    }
  }
}

function spawnOrDespawn(gameState, objective) {
  const { gameSeconds } = gameState;
  if (!objective.isAlive && objective.spawnAtSeconds !== null && gameSeconds >= objective.spawnAtSeconds) {
    objective.isAlive = true;
    objective.effortLeft = OBJECTIVE_EFFORT[objective.key];
    addEvent(gameState, { kind: EVENT_KIND.OBJECTIVE, team: null, text: `${objectiveName(objective)} has spawned` });
  }
  if (objective.isAlive && objective.despawnAtSeconds !== null && gameSeconds >= objective.despawnAtSeconds) {
    objective.isAlive = false;
    objective.spawnAtSeconds = null;
    addEvent(gameState, { kind: EVENT_KIND.OBJECTIVE, team: null, text: `${objectiveName(objective)} left the rift` });
  }
}

function progressObjective(gameState, objective, tickSeconds) {
  const presentByTeam = {
    [TEAM.BLUE]: championsAtPit(gameState, TEAM.BLUE, objective, TEAMFIGHT_JOIN_RANGE),
    [TEAM.RED]: championsAtPit(gameState, TEAM.RED, objective, TEAMFIGHT_JOIN_RANGE),
  };
  const contestersByTeam = {
    [TEAM.BLUE]: presentByTeam[TEAM.BLUE].filter(championState => isContesting(championState, objective)),
    [TEAM.RED]: presentByTeam[TEAM.RED].filter(championState => isContesting(championState, objective)),
  };
  const someoneContests = contestersByTeam[TEAM.BLUE].length + contestersByTeam[TEAM.RED].length >= MINIMUM_CONTESTERS_FOR_TEAMFIGHT;
  if (someoneContests && presentByTeam[TEAM.BLUE].length > 0 && presentByTeam[TEAM.RED].length > 0) {
    startTeamfight(gameState, objective.pit);
    return;
  }
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    const takers = contestersByTeam[team].filter(championState => distanceBetween(championState.position, objective.pit) <= OBJECTIVE_RANGE);
    if (takers.length === 0) {
      continue;
    }
    objective.effortLeft -= takers.reduce((sum, taker) => sum + fightPowerOf(gameState, taker), 0) * tickSeconds;
    if (objective.effortLeft <= 0) {
      awardObjective(gameState, objective, team);
    }
    return;
  }
}

function awardObjective(gameState, objective, team) {
  const teamState = gameState.teams[team];
  const takenName = objectiveName(objective);
  objective.isAlive = false;
  OBJECTIVE_REWARDS[objective.key](gameState, objective, teamState);
  endContestActions(gameState, team, objective);
  addEvent(gameState, { kind: EVENT_KIND.OBJECTIVE, team, text: `${TEAM_LABELS[team]} took ${takenName}` });
}

const OBJECTIVE_REWARDS = Object.freeze({
  [OBJECTIVE_KEY.DRAGON]: (gameState, objective, teamState) => {
    teamState.drakes.push(objective.element);
    const drakesTakenInGame = gameState.teams[TEAM.BLUE].drakes.length + gameState.teams[TEAM.RED].drakes.length;
    if (teamState.drakes.length >= DRAKES_FOR_SOUL) {
      teamState.soulElement = gameState.riftElement ?? objective.element;
      objective.spawnAtSeconds = null;
      gameState.objectives[OBJECTIVE_KEY.ELDER].spawnAtSeconds = gameState.gameSeconds + ELDER_SPAWN_DELAY_AFTER_SOUL_SECONDS;
      addEvent(gameState, { kind: EVENT_KIND.OBJECTIVE, team: teamState.team, text: `${TEAM_LABELS[teamState.team]} claimed the ${teamState.soulElement} Soul` });
      return;
    }
    if (drakesTakenInGame >= DRAKES_BEFORE_RIFT_ELEMENT) {
      gameState.riftElement ??= randomElement(gameState);
      objective.element = gameState.riftElement;
    } else {
      objective.element = randomElement(gameState);
    }
    objective.spawnAtSeconds = gameState.gameSeconds + DRAGON_RESPAWN_SECONDS;
  },
  [OBJECTIVE_KEY.ELDER]: (gameState, objective, teamState) => {
    teamState.elderUntilSeconds = gameState.gameSeconds + ELDER_BUFF_SECONDS;
    teamState.eldersTaken += 1;
    objective.spawnAtSeconds = gameState.gameSeconds + ELDER_RESPAWN_SECONDS;
  },
  [OBJECTIVE_KEY.GRUBS]: (gameState, objective, teamState) => {
    teamState.voidGrubs += VOID_GRUBS_COUNT;
    objective.spawnAtSeconds = null;
  },
  [OBJECTIVE_KEY.HERALD]: (gameState, objective, teamState) => {
    teamState.heraldsTaken += 1;
    objective.spawnAtSeconds = null;
    summonHerald(gameState, teamState.team);
  },
  [OBJECTIVE_KEY.BARON]: (gameState, objective, teamState) => {
    teamState.baronUntilSeconds = gameState.gameSeconds + BARON_BUFF_SECONDS;
    teamState.baronsTaken += 1;
    for (const championState of teamState.champions.filter(candidate => candidate.isAlive)) {
      grantGold(championState, BARON_GOLD_PER_CHAMPION);
    }
    objective.spawnAtSeconds = gameState.gameSeconds + BARON_RESPAWN_SECONDS;
  },
});

function summonHerald(gameState, team) {
  const enemyTeam = team === TEAM.BLUE ? TEAM.RED : TEAM.BLUE;
  const laneWithMostPush = gameState.lanes
    .filter(laneState => frontStructureOf(gameState, enemyTeam, laneState.lane))
    .reduce((best, laneState) => (!best || lanePushFor(gameState, laneState, team) > lanePushFor(gameState, best, team) ? laneState : best), null);
  if (!laneWithMostPush) {
    return;
  }
  const target = frontStructureOf(gameState, enemyTeam, laneWithMostPush.lane);
  addEvent(gameState, { kind: EVENT_KIND.OBJECTIVE, team, text: `${TEAM_LABELS[team]} sent the Herald ${laneWithMostPush.lane}` });
  damageStructure(gameState, target, HERALD_STRUCTURE_DAMAGE, team, []);
}

function endContestActions(gameState, team, objective) {
  for (const championState of gameState.teams[team].champions) {
    if (isContesting(championState, objective)) {
      championState.activeAction = null;
      championState.activity = ACTIVITY.TRAVELING;
      championState.targetPosition = null;
    }
  }
}

function championsAtPit(gameState, team, objective, range) {
  return gameState.teams[team].champions.filter(championState => championState.isAlive
    && championState.activity !== ACTIVITY.IN_FOUNTAIN
    && distanceBetween(championState.position, objective.pit) <= range);
}

function isContesting(championState, objective) {
  return championState.activeAction?.kind === ACTION_KIND.CONTEST && championState.activeAction.objectiveKey === objective.key;
}

function objectiveName(objective) {
  if (objective.key === OBJECTIVE_KEY.DRAGON) {
    return `the ${objective.element} Drake`;
  }
  if (objective.key === OBJECTIVE_KEY.BARON) {
    return `${OBJECTIVE_LABELS.baron} (${objective.variant})`;
  }
  return OBJECTIVE_LABELS[objective.key];
}

function randomElement(gameState) {
  return DRAGON_ELEMENTS[Math.floor(gameState.random() * DRAGON_ELEMENTS.length)];
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
