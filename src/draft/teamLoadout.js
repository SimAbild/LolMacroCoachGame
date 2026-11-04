import { ROLES } from '../config/roles.js';
import { defaultBuildTypeFor } from '../config/buildTypes.js';
import { DEFAULT_SUMMONERS_BY_ROLE } from '../config/summonerSpells.js';

export function createLoadoutFromRoleMap(champions, roleByChampionId) {
  return ROLES.map(role => {
    const champion = champions.find(candidate => roleByChampionId.get(candidate.id) === role);
    return createLoadoutEntry(role, champion);
  });
}

export function createLoadoutWithAutomaticRoles(champions) {
  return createLoadoutFromRoleMap(champions, assignRolesAutomatically(champions));
}

export function swapChampions(loadout, firstIndex, secondIndex) {
  const firstEntry = loadout[firstIndex];
  const secondEntry = loadout[secondIndex];
  const swappedLoadout = [...loadout];
  swappedLoadout[firstIndex] = createLoadoutEntry(firstEntry.role, secondEntry.champion);
  swappedLoadout[secondIndex] = createLoadoutEntry(secondEntry.role, firstEntry.champion);
  return swappedLoadout;
}

function createLoadoutEntry(role, champion) {
  return {
    role,
    champion,
    buildType: defaultBuildTypeFor(champion, role),
    summonerSpells: [...DEFAULT_SUMMONERS_BY_ROLE[role]],
  };
}

function assignRolesAutomatically(champions) {
  const roleByChampionId = new Map();
  const unassignedChampions = [];
  for (const champion of champions) {
    const preferredOpenRole = champion.roles.find(role => !isRoleTaken(roleByChampionId, role));
    if (preferredOpenRole) {
      roleByChampionId.set(champion.id, preferredOpenRole);
    } else {
      unassignedChampions.push(champion);
    }
  }
  for (const champion of unassignedChampions) {
    const firstOpenRole = ROLES.find(role => !isRoleTaken(roleByChampionId, role));
    roleByChampionId.set(champion.id, firstOpenRole);
  }
  return roleByChampionId;
}

function isRoleTaken(roleByChampionId, role) {
  return [...roleByChampionId.values()].includes(role);
}
