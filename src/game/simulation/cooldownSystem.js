import { TRINKET_MAX_CHARGES, TRINKET_RECHARGE_SECONDS } from '../../config/combatRules.js';
import { allChampionStates } from '../gameState.js';

export function updateCooldownsAndWards(gameState, tickSeconds) {
  gameState.wards = gameState.wards.filter(ward => ward.expiresAtSeconds > gameState.gameSeconds);
  for (const championState of allChampionStates(gameState)) {
    for (const spell of championState.summonerSpells) {
      spell.cooldownSeconds = Math.max(0, spell.cooldownSeconds - tickSeconds);
    }
    rechargeTrinket(championState, tickSeconds);
  }
}

function rechargeTrinket(championState, tickSeconds) {
  if (championState.trinketCharges >= TRINKET_MAX_CHARGES) {
    return;
  }
  championState.trinketRechargeSecondsLeft -= tickSeconds;
  if (championState.trinketRechargeSecondsLeft > 0) {
    return;
  }
  championState.trinketCharges += 1;
  championState.trinketRechargeSecondsLeft = championState.trinketCharges < TRINKET_MAX_CHARGES ? TRINKET_RECHARGE_SECONDS : 0;
}
