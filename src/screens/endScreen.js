import { createButton, createElement, createImage } from '../ui/dom.js';
import { formatGameTime } from '../ui/formatGameTime.js';
import { TEAM, TEAM_LABELS } from '../config/teams.js';
import { ROLE_LABELS } from '../config/roles.js';
import { destroyedEnemyTowerCount } from '../game/gameState.js';
import { createGoldChart } from './end/goldChart.js';
import { mountHomeScreen } from './homeScreen.js';

const GOLD_PER_THOUSAND = 1000;

export function mountEndScreen(root, { router, gameData, gameState }) {
  const playerWon = gameState.winner === gameState.playerSide;
  root.append(createElement('section', { className: 'end-screen', dataset: { result: playerWon ? 'victory' : 'defeat' } },
    createElement('header', { className: 'end-header' },
      createElement('h1', { className: 'end-header__result', text: playerWon ? 'Victory' : 'Defeat' }),
      createElement('p', {
        className: 'muted',
        text: `${TEAM_LABELS[gameState.winner]} destroyed the Nexus at ${formatGameTime(gameState.gameSeconds)}`,
      }),
    ),
    createElement('section', { className: 'end-panel' },
      createElement('h2', { text: 'Gold difference' }),
      createElement('p', { className: 'muted', text: 'Diamonds mark your calls. Hover the chart for exact values.' }),
      createGoldChart(gameState),
    ),
    createElement('div', { className: 'end-teams' },
      createTeamSummary(gameState, gameData, TEAM.BLUE),
      createTeamSummary(gameState, gameData, TEAM.RED),
    ),
    createButton('Play again', () => router.show(mountHomeScreen), 'button button--primary button--large'),
  ));
}

function createTeamSummary(gameState, gameData, team) {
  const teamState = gameState.teams[team];
  const youSuffix = team === gameState.playerSide ? ' (you)' : '';
  return createElement('section', { className: `end-panel end-team end-team--${team}` },
    createElement('h2', { text: `${TEAM_LABELS[team]}${youSuffix}` }),
    createElement('ul', { className: 'end-objectives' },
      ...[
        ['Kills', teamState.kills],
        ['Towers', destroyedEnemyTowerCount(gameState, team)],
        ['Drakes', teamState.drakes.length],
        ['Soul', teamState.soulElement ?? '–'],
        ['Grubs', teamState.voidGrubs],
        ['Heralds', teamState.heraldsTaken],
        ['Barons', teamState.baronsTaken],
        ['Elders', teamState.eldersTaken],
      ].map(([label, value]) => createElement('li', {},
        createElement('span', { className: 'muted', text: label }),
        createElement('strong', { text: String(value) }),
      )),
    ),
    createElement('table', { className: 'end-scoreboard' },
      createElement('thead', {}, createElement('tr', {},
        ...['Champion', 'K / D / A', 'Gold', 'Items'].map(heading => createElement('th', { text: heading })),
      )),
      createElement('tbody', {}, ...teamState.champions.map(championState => createElement('tr', {},
        createElement('td', {},
          createElement('div', { className: 'end-champion' },
            createImage(championState.champion.iconUrl, championState.champion.name, 'end-champion__icon'),
            createElement('div', {},
              createElement('strong', { text: championState.champion.name }),
              createElement('div', { className: 'muted', text: `${ROLE_LABELS[championState.role]} · Level ${championState.level}` }),
            ),
          ),
        ),
        createElement('td', { text: `${championState.kills} / ${championState.deaths} / ${championState.assists}` }),
        createElement('td', { text: `${(championState.totalGoldEarned / GOLD_PER_THOUSAND).toFixed(1)}K` }),
        createElement('td', {},
          createElement('div', { className: 'end-items' },
            ...championState.items.filter(item => item.paidGold >= item.cost).map(item => {
              const catalogItem = gameData.items.get(item.itemId);
              return createImage(catalogItem.iconUrl, catalogItem.name, 'end-items__icon');
            }),
          ),
        ),
      ))),
    ),
  );
}
