import { EXPERIENCE_FOR_LEVEL, MAX_LEVEL } from '../../config/gameRules.js';
import { ITEM_SLOTS } from '../gameState.js';

const SMALLEST_PAYMENT = 1;

export function grantGold(championState, amount) {
  championState.gold += amount;
  championState.totalGoldEarned += amount;
}

export function grantExperience(championState, amount) {
  championState.experience += amount;
  while (championState.level < MAX_LEVEL && championState.experience >= EXPERIENCE_FOR_LEVEL[championState.level + 1]) {
    championState.level += 1;
  }
}

export function hasItemsLeftToBuy(championState) {
  return championState.remainingBuildPath.length > 0 || championState.items.some(isUnfinished);
}

export function spendGoldOnBuild(championState, itemCatalog) {
  while (championState.gold >= SMALLEST_PAYMENT) {
    const itemInProgress = championState.items.find(isUnfinished) ?? startNextItem(championState, itemCatalog);
    if (!itemInProgress) {
      return;
    }
    const payment = Math.min(championState.gold, itemInProgress.cost - itemInProgress.paidGold);
    itemInProgress.paidGold += payment;
    championState.gold -= payment;
  }
}

function startNextItem(championState, itemCatalog) {
  while (championState.remainingBuildPath.length > 0) {
    const nextItem = itemCatalog.get(championState.remainingBuildPath.shift());
    if (!nextItem) {
      continue;
    }
    if (championState.items.length >= ITEM_SLOTS && !sellStartingItem(championState)) {
      return null;
    }
    const itemInProgress = { itemId: nextItem.id, cost: nextItem.cost, paidGold: 0, isStartingItem: false };
    championState.items.push(itemInProgress);
    return itemInProgress;
  }
  return null;
}

function sellStartingItem(championState) {
  const startingItemIndex = championState.items.findIndex(item => item.isStartingItem);
  if (startingItemIndex === -1) {
    return false;
  }
  championState.items.splice(startingItemIndex, 1);
  return true;
}

function isUnfinished(item) {
  return item.paidGold < item.cost;
}
