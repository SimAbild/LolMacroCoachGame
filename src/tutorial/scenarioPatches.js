import { OUTER_TOWER_PLATES } from '../config/structureRules.js';
import { ACTIVITY } from '../game/activities.js';
import { EVENT_KIND, addEvent } from '../game/events.js';
import { SCRIPTED_ROLL } from '../game/random.js';
import { grantExperience, grantGold, spendGoldOnBuild } from '../game/simulation/economy.js';
import { championWithRole, structureOf } from './predicates.js';

// Just enough health above the next plate that the first hits of a siege break it.
const NEXT_PLATE_MARGIN = 0.02;

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

// A lead earned while the time skipped. The gold goes straight into items, because holding it
// would send the whole team back to base to shop just as the next lesson starts.
export function giveLead(gameState, { team, gold, experience }) {
  for (const championState of gameState.teams[team].champions) {
    grantGold(championState, gold);
    grantExperience(championState, experience);
    spendGoldOnBuild(championState, gameState.itemCatalog);
  }
}

// As if the team just came back from shopping: nobody heads home for items during the lesson.
export function shopAndRefreshTeam(gameState, team) {
  giveLead(gameState, { team, gold: 0, experience: 0 });
  refreshTeam(gameState, team);
}

// Full health, and nobody waiting in base: a call to a champion in base is refused,
// and a refused call would leave the player stuck on a step that only allows that call.
export function refreshTeam(gameState, team) {
  for (const championState of gameState.teams[team].champions.filter(candidate => candidate.isAlive)) {
    championState.healthRatio = 1;
    championState.resourceRatio = 1;
    if (championState.activity === ACTIVITY.IN_FOUNTAIN) {
      championState.activity = ACTIVITY.TRAVELING;
    }
  }
}

// Contest objective picks a living objective over one about to spawn, so another objective
// that is up would take the team away from the one the lesson is about.
export function delayObjective(gameState, objectiveKey, spawnAtSeconds) {
  const objective = gameState.objectives[objectiveKey];
  objective.isAlive = false;
  objective.spawnAtSeconds = spawnAtSeconds;
}

export function chipTowerToNextPlate(gameState, where) {
  const tower = structureOf(gameState, where);
  if (tower.isStanding && tower.platesLeft > 0) {
    tower.healthRatio = (tower.platesLeft - 1) / OUTER_TOWER_PLATES + NEXT_PLATE_MARGIN;
  }
}

// Sets the state directly: really destroying a tower would pay gold and write kill feed lines
// for something that happened during the skip, and could even end the game.
export function removeTowers(gameState, { team, tiersByLane }) {
  const isRemoved = structure => tiersByLane[structure.lane]?.includes(structure.tier);
  for (const tower of gameState.teams[team].structures.filter(isRemoved)) {
    tower.isStanding = false;
    tower.healthRatio = 0;
    tower.platesLeft = 0;
  }
}
