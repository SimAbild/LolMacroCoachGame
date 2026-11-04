const MIN_RATING = 1;
const MAX_RATING = 10;
const BASE_RATING = 4;
const STAT_POINTS_PER_RATING_POINT = 4;

const TAG_RATING_BONUSES = Object.freeze({
  Tank: { gank: 2, dive: 3, escape: -1, teamfight: 2 },
  Fighter: { gank: 1, dive: 2, escape: 0, teamfight: 1 },
  Assassin: { gank: 2, dive: 2, escape: 3, teamfight: -1 },
  Mage: { gank: 0, dive: -1, escape: 0, teamfight: 2 },
  Marksman: { gank: -1, dive: -2, escape: 1, teamfight: 2 },
  Support: { gank: 1, dive: -1, escape: 0, teamfight: 2 },
});

const MANUAL_RATING_OVERRIDES = Object.freeze({
  Sejuani: { gank: 9 },
  LeeSin: { gank: 9, escape: 7 },
  Fiora: { escape: 7 },
  Ezreal: { escape: 8 },
  Kassadin: { escape: 8 },
  Orianna: { teamfight: 9 },
  Malphite: { dive: 8, teamfight: 9 },
  Amumu: { teamfight: 9 },
});

export function deriveChampionRatings(championSummary) {
  const ratings = {
    gank: BASE_RATING + Math.round(championSummary.info.attack / STAT_POINTS_PER_RATING_POINT),
    dive: BASE_RATING + Math.round(championSummary.info.defense / STAT_POINTS_PER_RATING_POINT),
    escape: BASE_RATING,
    teamfight: BASE_RATING + Math.round(championSummary.info.magic / STAT_POINTS_PER_RATING_POINT),
  };
  for (const tag of championSummary.tags) {
    addTagBonuses(ratings, TAG_RATING_BONUSES[tag]);
  }
  Object.assign(ratings, MANUAL_RATING_OVERRIDES[championSummary.id]);
  return clampRatings(ratings);
}

function addTagBonuses(ratings, bonuses) {
  if (!bonuses) {
    return;
  }
  for (const [ratingName, bonus] of Object.entries(bonuses)) {
    ratings[ratingName] += bonus;
  }
}

function clampRatings(ratings) {
  return Object.freeze(Object.fromEntries(
    Object.entries(ratings).map(([ratingName, value]) => [ratingName, Math.min(MAX_RATING, Math.max(MIN_RATING, value))]),
  ));
}
