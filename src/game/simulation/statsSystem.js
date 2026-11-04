import { TEAM } from '../../config/teams.js';
import { totalTeamGold } from '../gameState.js';

const GOLD_SAMPLE_INTERVAL_SECONDS = 30;

export function updateGoldHistory(gameState) {
  const lastSample = gameState.goldHistory[gameState.goldHistory.length - 1];
  const isSampleDue = !lastSample || gameState.gameSeconds - lastSample.gameSeconds >= GOLD_SAMPLE_INTERVAL_SECONDS || gameState.winner;
  if (!isSampleDue) {
    return;
  }
  gameState.goldHistory.push({
    gameSeconds: gameState.gameSeconds,
    [TEAM.BLUE]: totalTeamGold(gameState.teams[TEAM.BLUE]),
    [TEAM.RED]: totalTeamGold(gameState.teams[TEAM.RED]),
  });
}
