import { fetchItemSummaries, itemIconUrl } from './dataDragon.js';

export async function loadItemCatalog(version) {
  const itemSummariesById = await fetchItemSummaries(version);
  const catalog = new Map();
  for (const [itemId, summary] of Object.entries(itemSummariesById)) {
    catalog.set(itemId, Object.freeze({
      id: itemId,
      name: summary.name,
      cost: summary.gold.total,
      iconUrl: itemIconUrl(version, summary.image.full),
    }));
  }
  return catalog;
}
