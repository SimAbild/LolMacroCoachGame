const DATA_DRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';
const DATA_LOCALE = 'en_US';

export async function fetchLatestVersion() {
  const versions = await fetchJson(`${DATA_DRAGON_BASE_URL}/api/versions.json`);
  return versions[0];
}

export async function fetchChampionSummaries(version) {
  const response = await fetchJson(`${DATA_DRAGON_BASE_URL}/cdn/${version}/data/${DATA_LOCALE}/champion.json`);
  return Object.values(response.data);
}

export async function fetchItemSummaries(version) {
  const response = await fetchJson(`${DATA_DRAGON_BASE_URL}/cdn/${version}/data/${DATA_LOCALE}/item.json`);
  return response.data;
}

export function itemIconUrl(version, imageFileName) {
  return `${DATA_DRAGON_BASE_URL}/cdn/${version}/img/item/${imageFileName}`;
}

export function minimapImageUrl(version) {
  return `${DATA_DRAGON_BASE_URL}/cdn/${version}/img/map/map11.png`;
}

export function championIconUrl(version, imageFileName) {
  return `${DATA_DRAGON_BASE_URL}/cdn/${version}/img/champion/${imageFileName}`;
}

export function summonerSpellIconUrl(version, iconId) {
  return `${DATA_DRAGON_BASE_URL}/cdn/${version}/img/spell/${iconId}.png`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Data Dragon request failed (${response.status}): ${url}`);
  }
  return response.json();
}
