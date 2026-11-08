import {
  BUILD_TOUGHNESS, DEFENSE_TOUGHNESS_DIVISOR, ITEM_GOLD_PER_FULL_POWER, LEVEL_POWER_PER_LEVEL, TANK_TOUGHNESS,
  TEAMFIGHT_RATING_BASE, TEAMFIGHT_RATING_PER_POINT,
} from '../config/teamfightRules.js';
import { BARON_POWER, DRAKE_POWER_PER_STACK, ELDER_POWER, SOUL_POWER } from '../config/objectiveRules.js';

export function fightPowerOf(gameState, championState) {
  const levelFactor = 1 + (championState.level - 1) * LEVEL_POWER_PER_LEVEL;
  const itemFactor = 1 + itemGoldOf(championState) / ITEM_GOLD_PER_FULL_POWER;
  const ratingFactor = TEAMFIGHT_RATING_BASE + championState.champion.ratings.teamfight * TEAMFIGHT_RATING_PER_POINT;
  const buffFactor = 1 + teamBuffPower(gameState, championState.team);
  return levelFactor * itemFactor * ratingFactor * buffFactor;
}

export function toughnessOf(championState) {
  const tankBonus = championState.champion.tags.includes('Tank') ? TANK_TOUGHNESS : 0;
  const buildBonus = BUILD_TOUGHNESS[championState.buildType] ?? 0;
  return 1 + tankBonus + buildBonus + championState.champion.info.defense / DEFENSE_TOUGHNESS_DIVISOR;
}

export function teamBuffPower(gameState, team) {
  const teamState = gameState.teams[team];
  return teamState.drakes.length * DRAKE_POWER_PER_STACK
    + (teamState.soulElement ? SOUL_POWER : 0)
    + (hasActiveBuff(gameState, teamState.elderUntilSeconds) ? ELDER_POWER : 0)
    + (hasActiveBuff(gameState, teamState.baronUntilSeconds) ? BARON_POWER : 0);
}

export function hasBaron(gameState, team) {
  return hasActiveBuff(gameState, gameState.teams[team].baronUntilSeconds);
}

export function hasElder(gameState, team) {
  return hasActiveBuff(gameState, gameState.teams[team].elderUntilSeconds);
}

function hasActiveBuff(gameState, untilSeconds) {
  return gameState.gameSeconds < untilSeconds;
}

export function itemGoldOf(championState) {
  return championState.items.reduce((sum, item) => sum + item.paidGold, 0);
}
