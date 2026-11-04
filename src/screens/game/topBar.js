import { createButton, createElement } from '../../ui/dom.js';
import { TEAM, TEAM_LABELS } from '../../config/teams.js';
import { GAME_SPEEDS } from '../../game/gameClock.js';
import { destroyedEnemyTowerCount, totalTeamGold } from '../../game/gameState.js';
import { formatGameTime } from '../../ui/formatGameTime.js';

const GOLD_PER_THOUSAND = 1000;
const DRAKES_FOR_SOUL = 4;

const ICONS = Object.freeze({
  tower: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h3v2h2V3h2v2h2V3h3v5l-2 2v9h2v2H6v-2h2v-9L6 8z"/></svg>',
  gold: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" opacity=".45"/></svg>',
  grub: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14c0-4 4-8 8-8s8 4 8 8-3 4-8 4-8 0-8-4z"/></svg>',
});

export function createTopBar({ playerSide, onSpeedChange, onLeave }) {
  const teamStats = { [TEAM.BLUE]: createTeamStats(TEAM.BLUE), [TEAM.RED]: createTeamStats(TEAM.RED) };
  const blueKills = createElement('span', { className: 'scoreboard__kills scoreboard__kills--blue' });
  const redKills = createElement('span', { className: 'scoreboard__kills scoreboard__kills--red' });
  const timer = createElement('span', { className: 'scoreboard__timer' });
  const speedButtons = GAME_SPEEDS.map(speed => {
    const button = createButton(`${speed}x`, () => {
      onSpeedChange(speed);
      speedButtons.forEach(other => other.classList.toggle('is-active', other === button));
    }, 'speed-button');
    button.classList.toggle('is-active', speed === GAME_SPEEDS[0]);
    return button;
  });

  const element = createElement('div', { className: 'scoreboard' },
    createButton('Leave', onLeave, 'scoreboard__leave'),
    teamStats[TEAM.BLUE].element,
    createElement('div', { className: 'scoreboard__center' }, blueKills, createElement('span', { className: 'scoreboard__divider', text: '—' }), redKills),
    teamStats[TEAM.RED].element,
    createElement('div', { className: 'scoreboard__clock' }, timer, createElement('div', { className: 'speed-buttons' }, ...speedButtons)),
  );

  function createTeamStats(team) {
    const youSuffix = team === playerSide ? ' (you)' : '';
    const towers = createElement('span', { className: 'stat__value' });
    const gold = createElement('span', { className: 'stat__value' });
    const grubs = createElement('span', { className: 'stat__value' });
    const drakeSlots = Array.from({ length: DRAKES_FOR_SOUL }, () => createElement('span', { className: 'drake-slot' }));
    const statsElement = createElement('div', { className: `scoreboard__team scoreboard__team--${team}` },
      createElement('span', { className: 'scoreboard__team-name', text: `${TEAM_LABELS[team].toUpperCase()}${youSuffix}` }),
      createStat('tower', 'Towers destroyed', towers),
      createStat('gold', 'Total gold', gold),
      createStat('grub', 'Void grubs', grubs),
      createElement('span', { className: 'drake-slots', attributes: { title: 'Drakes' } }, ...drakeSlots),
    );
    return { element: statsElement, towers, gold, grubs, drakeSlots };
  }

  function update(gameState) {
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      const teamState = gameState.teams[team];
      const stats = teamStats[team];
      stats.towers.textContent = String(destroyedEnemyTowerCount(gameState, team));
      stats.gold.textContent = formatGold(totalTeamGold(teamState));
      stats.grubs.textContent = String(teamState.voidGrubs);
      stats.drakeSlots.forEach((slot, index) => {
        slot.dataset.element = teamState.drakes[index] ?? '';
      });
    }
    blueKills.textContent = String(gameState.teams[TEAM.BLUE].kills);
    redKills.textContent = String(gameState.teams[TEAM.RED].kills);
    timer.textContent = formatGameTime(gameState.gameSeconds);
  }

  return { element, update };
}

function createStat(iconName, title, valueElement) {
  const icon = createElement('span', { className: 'stat__icon' });
  icon.innerHTML = ICONS[iconName];
  return createElement('span', { className: 'stat', attributes: { title } }, icon, valueElement);
}

function formatGold(gold) {
  return `${(gold / GOLD_PER_THOUSAND).toFixed(1)}K`;
}
