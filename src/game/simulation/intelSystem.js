import { TEAM, opposingTeam } from '../../config/teams.js';
import { isPositionVisible, teamVisionSources } from '../vision.js';

// Each team remembers where and when it last saw every enemy (used by the AI coach and alerts).
export function updateIntel(gameState) {
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    recordSightings(gameState, team);
  }
}

function recordSightings(gameState, team) {
  const teamVision = teamVisionSources(gameState, team);
  const seenEnemies = gameState.teams[opposingTeam(team)].champions
    .filter(enemy => enemy.isAlive && isPositionVisible(enemy.position, teamVision));
  for (const enemy of seenEnemies) {
    gameState.intel[team][enemy.id] = { position: { ...enemy.position }, gameSeconds: gameState.gameSeconds };
  }
}

export function lastSeenPosition(gameState, team, enemyId) {
  return gameState.intel[team][enemyId]?.position ?? null;
}

export function secondsSinceSeen(gameState, team, enemyId) {
  const record = gameState.intel[team][enemyId];
  return record ? gameState.gameSeconds - record.gameSeconds : Infinity;
}
