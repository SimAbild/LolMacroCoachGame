import { fetchLatestVersion } from './dataDragon.js';
import { loadChampions } from './championRepository.js';
import { loadItemCatalog } from './itemRepository.js';

export async function loadGameData() {
  const version = await fetchLatestVersion();
  const [champions, items] = await Promise.all([loadChampions(version), loadItemCatalog(version)]);
  return Object.freeze({ version, champions, items });
}
