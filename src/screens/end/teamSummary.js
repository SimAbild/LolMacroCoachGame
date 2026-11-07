import { createElement, createImage } from '../../ui/dom.js';
import { TEAM_LABELS } from '../../config/teams.js';
import { ROLE_LABELS } from '../../config/roles.js';
import { destroyedEnemyTowerCount } from '../../game/gameState.js';

const GOLD_PER_THOUSAND = 1000;

// One team's panel on the end screen: what it took, and every champion's score and items.
export function createTeamSummary(gameState, gameData, team) {
  const youSuffix = team === gameState.playerSide ? ' (you)' : '';
  return createElement('section', { className: `end-panel end-team end-team--${team}` },
    createElement('h2', { text: `${TEAM_LABELS[team]}${youSuffix}` }),
    createObjectiveList(gameState, team),
    createScoreboard(gameState.teams[team].champions, gameData.items),
  );
}

function createObjectiveList(gameState, team) {
  const teamState = gameState.teams[team];
  const tally = [
    ['Kills', teamState.kills],
    ['Towers', destroyedEnemyTowerCount(gameState, team)],
    ['Drakes', teamState.drakes.length],
    ['Soul', teamState.soulElement ?? '–'],
    ['Grubs', teamState.voidGrubs],
    ['Heralds', teamState.heraldsTaken],
    ['Barons', teamState.baronsTaken],
    ['Elders', teamState.eldersTaken],
  ];
  return createElement('ul', { className: 'end-objectives' }, ...tally.map(([label, value]) => createElement('li', {},
    createElement('span', { className: 'muted', text: label }),
    createElement('strong', { text: String(value) }),
  )));
}

function createScoreboard(championStates, itemCatalog) {
  return createElement('table', { className: 'end-scoreboard' },
    createElement('thead', {}, createElement('tr', {},
      ...['Champion', 'K / D / A', 'Gold', 'Items'].map(heading => createElement('th', { text: heading })),
    )),
    createElement('tbody', {}, ...championStates.map(championState => createChampionRow(championState, itemCatalog))),
  );
}

function createChampionRow(championState, itemCatalog) {
  const { champion, role, level, kills, deaths, assists, totalGoldEarned } = championState;
  return createElement('tr', {},
    createElement('td', {}, createElement('div', { className: 'end-champion' },
      createImage(champion.iconUrl, champion.name, 'end-champion__icon'),
      createElement('div', {},
        createElement('strong', { text: champion.name }),
        createElement('div', { className: 'muted', text: `${ROLE_LABELS[role]} · Level ${level}` }),
      ),
    )),
    createElement('td', { text: `${kills} / ${deaths} / ${assists}` }),
    createElement('td', { text: `${(totalGoldEarned / GOLD_PER_THOUSAND).toFixed(1)}K` }),
    createElement('td', {}, createFinishedItems(championState.items, itemCatalog)),
  );
}

// Items the champion was still saving up for are left out.
function createFinishedItems(items, itemCatalog) {
  return createElement('div', { className: 'end-items' },
    ...items.filter(item => item.paidGold >= item.cost).map(item => {
      const catalogItem = itemCatalog.get(item.itemId);
      return createImage(catalogItem.iconUrl, catalogItem.name, 'end-items__icon');
    }),
  );
}
