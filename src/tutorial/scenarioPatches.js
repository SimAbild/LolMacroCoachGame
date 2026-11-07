import { EVENT_KIND, addEvent } from '../game/events.js';
import { SCRIPTED_ROLL } from '../game/random.js';
import { championWithRole } from './predicates.js';

// Small, named changes the tutorial makes to the game while it stands still, each with a reason
// in the story (shown in the kill feed), so a lesson always has the situation it needs.

export function woundChampion(gameState, { team, role, healthRatio }) {
  const championState = championWithRole(gameState, team, role);
  championState.healthRatio = Math.min(championState.healthRatio, healthRatio);
}

export function putSpellOnCooldown(gameState, { team, role, spellId, seconds }) {
  const spell = championWithRole(gameState, team, role).summonerSpells.find(candidate => candidate.spellId === spellId);
  if (spell) {
    spell.cooldownSeconds = seconds;
  }
}

// Decides the next gank's catch roll in advance (see takeScriptedRoll in game/random.js).
export function scriptNextCatch(gameState, isCaught) {
  gameState.scriptedRolls[SCRIPTED_ROLL.PLAY_CATCH] = [isCaught];
}

export function tellInKillFeed(gameState, { team, text }) {
  addEvent(gameState, { kind: EVENT_KIND.FIGHT, team, text });
}
