import { TEAM } from '../config/teams.js';
import { ROLE } from '../config/roles.js';
import { DRAFT_STEPS } from '../config/draftOrder.js';

export const TUTORIAL_SIDE = TEAM.BLUE;

// One entry per draft step, in DRAFT_STEPS order. Picks name the role the champion will play.
// Red bans junglers, blue bans threats; blue ends up with Volibear and Malphite in the wrong
// roles on purpose, so the swap phase has something to teach.
const DRAFT_SCRIPT = Object.freeze([
  { name: 'Zed' }, { name: 'Sejuani' }, { name: 'Yasuo' }, { name: 'Vi' }, { name: 'Thresh' }, { name: 'Amumu' },
  { name: 'Volibear', role: ROLE.JUNGLE },
  { name: 'Jinx', role: ROLE.BOT },
  { name: 'Nunu & Willump', role: ROLE.JUNGLE },
  { name: 'Orianna', role: ROLE.MID },
  { name: 'Ezreal', role: ROLE.BOT },
  { name: 'Ahri', role: ROLE.MID },
  { name: 'Lux' }, { name: 'Darius' }, { name: 'Galio' }, { name: 'Nami' },
  { name: 'Soraka', role: ROLE.SUPPORT },
  { name: 'Leona', role: ROLE.SUPPORT },
  { name: 'Malphite', role: ROLE.TOP },
  { name: 'Jayce', role: ROLE.TOP },
]);

// Everything the guided game is set up from.
export function createScenario(champions) {
  return { draftScript: resolveDraftScript(champions), gameOptions: {} };
}

// Data Dragon changes with every patch. A scripted champion that is missing is replaced by an
// unused champion for the same role (any unused champion for a ban), and marked as a fallback.
function resolveDraftScript(champions) {
  const usedIds = new Set();
  return DRAFT_SCRIPT.map((entry, stepIndex) => {
    const champion = champions.find(candidate => candidate.name === entry.name && !usedIds.has(candidate.id))
      ?? fallbackChampion(champions, entry, usedIds);
    usedIds.add(champion.id);
    return { ...DRAFT_STEPS[stepIndex], ...entry, champion, isFallback: champion.name !== entry.name };
  });
}

function fallbackChampion(champions, entry, usedIds) {
  const unused = champions.filter(candidate => !usedIds.has(candidate.id) && !DRAFT_SCRIPT.some(scripted => scripted.name === candidate.name));
  const sameRole = entry.role ? unused.find(candidate => candidate.roles.includes(entry.role)) : null;
  return sameRole ?? unused[0];
}

export function scriptEntryFor(draftScript, championName) {
  return draftScript.find(entry => entry.name === championName);
}
