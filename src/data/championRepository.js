import { ROLE, ROLES } from '../config/roles.js';
import { championIconUrl, fetchChampionSummaries } from './dataDragon.js';
import { CHAMPION_NAMES_BY_ROLE } from './championRoles.js';
import { deriveChampionRatings } from './championRatings.js';

const FALLBACK_ROLE_BY_PRIMARY_TAG = Object.freeze({
  Marksman: ROLE.BOT,
  Support: ROLE.SUPPORT,
  Tank: ROLE.TOP,
  Fighter: ROLE.TOP,
  Mage: ROLE.MID,
  Assassin: ROLE.MID,
});

export async function loadChampions(version) {
  const summaries = await fetchChampionSummaries(version);
  return summaries
    .map(summary => createChampion(summary, version))
    .sort((first, second) => first.name.localeCompare(second.name));
}

function createChampion(summary, version) {
  return Object.freeze({
    id: summary.id,
    name: summary.name,
    tags: summary.tags,
    info: summary.info,
    resourceType: summary.partype,
    iconUrl: championIconUrl(version, summary.image.full),
    roles: rolesForChampion(summary),
    ratings: deriveChampionRatings(summary),
  });
}

function rolesForChampion(summary) {
  const listedRoles = ROLES.filter(role => CHAMPION_NAMES_BY_ROLE[role].includes(summary.name));
  if (listedRoles.length > 0) {
    return Object.freeze(listedRoles);
  }
  const [primaryTag] = summary.tags;
  return Object.freeze([FALLBACK_ROLE_BY_PRIMARY_TAG[primaryTag] ?? ROLE.TOP]);
}
