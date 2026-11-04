import { TEAM, opposingTeam } from '../../config/teams.js';
import { isPositionVisible, teamVisionSources } from '../vision.js';

export function updateIntel(gameState) {
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    const teamVision = teamVisionSources(gameState, team);
    for (const enemy of gameState.teams[opposingTeam(team)].champions) {
      if (enemy.isAlive && isPositionVisible(enemy.position, teamVision)) {
        gameState.intel[team][enemy.id] = { position: { ...enemy.position }, gameSeconds: gameState.gameSeconds };
      }
    }
  }
}

export function lastSeenPosition(gameState, team, enemyId) {
  return gameState.intel[team][enemyId]?.position ?? null;
}

export function secondsSinceSeen(gameState, team, enemyId) {
  const record = gameState.intel[team][enemyId];
  return record ? gameState.gameSeconds - record.gameSeconds : Infinity;
}
