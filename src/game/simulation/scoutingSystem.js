import { opposingTeam } from '../../config/teams.js';
import { isPositionVisible, visionSourcesFor } from '../vision.js';

export function updateScouting(gameState) {
  const playerVisionSources = visionSourcesFor(gameState, gameState.playerSide);
  for (const enemy of gameState.teams[opposingTeam(gameState.playerSide)].champions) {
    enemy.isVisibleToPlayer = enemy.isAlive && isPositionVisible(enemy.position, playerVisionSources);
    if (enemy.isVisibleToPlayer || !enemy.lastSeen) {
      enemy.lastSeen = snapshotOf(enemy);
    }
  }
}

export function displayedStateFor(championState, playerSide) {
  return championState.team === playerSide ? championState : { ...championState, ...championState.lastSeen };
}

function snapshotOf(championState) {
  return {
    level: championState.level,
    healthRatio: championState.healthRatio,
    resourceRatio: championState.resourceRatio,
    items: championState.items.map(item => ({ ...item })),
    summonerSpells: championState.summonerSpells.map(spell => ({ ...spell })),
    activity: championState.activity,
    activitySecondsLeft: championState.activitySecondsLeft,
  };
}
