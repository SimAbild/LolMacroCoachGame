import { ROLE } from '../../config/roles.js';
import {
  ARRIVAL_DISTANCE, JUNGLE_CAMP_CLEAR_SECONDS, JUNGLE_CAMP_CREEP_SCORE, JUNGLE_CAMP_EXPERIENCE, JUNGLE_CAMP_GOLD, JUNGLE_CAMP_HEALTH_COST,
  JUNGLE_CAMP_RESPAWN_SECONDS, MINIMUM_HEALTH_WITHOUT_COMBAT,
} from '../../config/gameRules.js';
import { ACTIVITY } from '../activities.js';
import { allChampionStates } from '../gameState.js';
import { grantExperience, grantGold } from './economy.js';
import { distanceBetween } from '../geometry.js';

export function updateJungle(gameState, tickSeconds) {
  const junglers = allChampionStates(gameState).filter(championState => championState.role === ROLE.JUNGLE);
  for (const jungler of junglers) {
    if (jungler.activity !== ACTIVITY.JUNGLING) {
      continue;
    }
    jungler.targetCamp ??= chooseNextCamp(gameState, jungler);
    clearCampIfInRange(gameState, jungler, tickSeconds);
  }
}

export function isCampAlive(camp, gameSeconds) {
  return gameSeconds >= camp.respawnAtSeconds;
}

export function chooseNextCamp(gameState, jungler) {
  const ownCamps = gameState.jungleCamps.filter(camp => camp.team === jungler.team);
  const aliveCamps = ownCamps.filter(camp => isCampAlive(camp, gameState.gameSeconds));
  if (aliveCamps.length > 0) {
    return nearestCamp(aliveCamps, jungler.position);
  }
  return ownCamps.reduce((soonest, camp) => (camp.respawnAtSeconds < soonest.respawnAtSeconds ? camp : soonest));
}

function clearCampIfInRange(gameState, jungler, tickSeconds) {
  const camp = jungler.targetCamp;
  const isAtCamp = distanceBetween(jungler.position, camp.position) <= ARRIVAL_DISTANCE;
  if (!isAtCamp || !isCampAlive(camp, gameState.gameSeconds)) {
    return;
  }
  camp.clearProgressSeconds += tickSeconds;
  if (camp.clearProgressSeconds < JUNGLE_CAMP_CLEAR_SECONDS) {
    return;
  }
  camp.clearProgressSeconds = 0;
  camp.respawnAtSeconds = gameState.gameSeconds + JUNGLE_CAMP_RESPAWN_SECONDS;
  grantGold(jungler, JUNGLE_CAMP_GOLD);
  grantExperience(jungler, JUNGLE_CAMP_EXPERIENCE);
  jungler.creepScore += JUNGLE_CAMP_CREEP_SCORE;
  jungler.healthRatio = Math.max(MINIMUM_HEALTH_WITHOUT_COMBAT, jungler.healthRatio - JUNGLE_CAMP_HEALTH_COST);
  jungler.targetCamp = null;
}

function nearestCamp(camps, position) {
  const distanceTo = camp => distanceBetween(camp.position, position);
  return camps.reduce((nearest, camp) => (distanceTo(camp) < distanceTo(nearest) ? camp : nearest));
}
