import { ROLES } from '../config/roles.js';
import { INTENT } from '../core/intents.js';
import { defaultBuildTypeFor } from '../config/buildTypes.js';
import { DEFAULT_SUMMONERS_BY_ROLE } from '../config/summonerSpells.js';

export function createLoadoutFromRoleMap(champions, roleByChampionId) {
  return ROLES.map(role => {
    const champion = champions.find(candidate => roleByChampionId.get(candidate.id) === role);
    return createLoadoutEntry(role, champion);
  });
}

// The loadouts both teams start the swap phase with: the player's roles are a best guess
// (to be swapped), the AI's are the roles it drafted its champions for.
export function createDraftLoadouts(draftState, { playerSide, aiTeam, aiRoleByChampionId }) {
  return {
    [playerSide]: createLoadoutWithAutomaticRoles(draftState.picksFor(playerSide)),
    [aiTeam]: createLoadoutFromRoleMap(draftState.picksFor(aiTeam), aiRoleByChampionId),
  };
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

// Applies a swap-phase intent and returns the changed loadout (the original is left as it was).
// The swap screen and the headless tutorial check both change loadouts through this.
export function applyLoadoutIntent(loadout, intent) {
  return LOADOUT_CHANGES[intent.type](loadout, intent);
}

const LOADOUT_CHANGES = Object.freeze({
  [INTENT.LOADOUT_SWAP]: (loadout, { fromIndex, toIndex }) => swapChampions(loadout, fromIndex, toIndex),
  [INTENT.LOADOUT_BUILD]: (loadout, { role, buildType }) => changeEntry(loadout, role, () => ({ buildType })),
  [INTENT.LOADOUT_SPELL]: (loadout, { role, spellSlot, spellId }) => changeEntry(loadout, role, entry => ({
    summonerSpells: withSummonerSpell(entry.summonerSpells, spellSlot, spellId),
  })),
});

function changeEntry(loadout, role, changesFor) {
  return loadout.map(entry => (entry.role === role ? { ...entry, ...changesFor(entry) } : entry));
}

// Picking the spell that is already in the other slot swaps the two, so a champion never has it twice.
function withSummonerSpell(currentSpells, spellSlot, newSpellId) {
  const otherSlot = spellSlot === 0 ? 1 : 0;
  const changedSpells = [...currentSpells];
  if (changedSpells[otherSlot] === newSpellId) {
    changedSpells[otherSlot] = changedSpells[spellSlot];
  }
  changedSpells[spellSlot] = newSpellId;
  return changedSpells;
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
