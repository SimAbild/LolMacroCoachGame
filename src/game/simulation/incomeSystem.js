import { ROLE } from '../../config/roles.js';
import { PASSIVE_GOLD_PER_SECOND, PASSIVE_GOLD_START_SECONDS, SUPPORT_ITEM_GOLD_PER_SECOND } from '../../config/gameRules.js';
import { allChampionStates } from '../gameState.js';
import { grantGold } from './economy.js';

export function updateIncome(gameState, tickSeconds) {
  if (gameState.gameSeconds < PASSIVE_GOLD_START_SECONDS) {
    return;
  }
  for (const championState of allChampionStates(gameState)) {
    const supportBonus = championState.role === ROLE.SUPPORT ? SUPPORT_ITEM_GOLD_PER_SECOND : 0;
    grantGold(championState, (PASSIVE_GOLD_PER_SECOND + supportBonus) * tickSeconds);
  }
}
