import { createButton, createElement } from '../../ui/dom.js';
import { TEAM, TEAM_LABELS } from '../../config/teams.js';
import { DEFAULT_GAME_SPEED, GAME_SPEEDS, GAME_SPEED_KEYS, PAUSE_REASON } from '../../game/gameClock.js';
import { destroyedEnemyTowerCount, totalTeamGold } from '../../game/gameState.js';
import { formatGameTime } from '../../ui/formatGameTime.js';

const GOLD_PER_THOUSAND = 1000;
const DRAKES_FOR_SOUL = 4;

const ICONS = Object.freeze({
  tower: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h3v2h2V3h2v2h2V3h3v5l-2 2v9h2v2H6v-2h2v-9L6 8z"/></svg>',
  gold: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" opacity=".45"/></svg>',
  grub: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14c0-4 4-8 8-8s8 4 8 8-3 4-8 4-8 0-8-4z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>',
});

// The bar along the top: Leave, the scoreboard in the middle, and the settings toggles in the
// corner. The game screen moves the app's fullscreen button into `corner`, after the toggles.
// `isAutoPauseAvailable` is false in the guided game, which decides itself when it stands still.
export function createTopBar({ playerSide, onSpeedChange, onPauseToggle, onSlowMotionToggle, onAutoPauseToggle, onLeave, isAutoPauseAvailable = true }) {
  const scoreboard = createScoreboard({ playerSide, onSpeedChange, onPauseToggle });
  const leaveButton = createButton('Leave', onLeave, 'top-bar__leave');
  leaveButton.dataset.anchor = 'leave';
  const corner = createElement('div', { className: 'top-bar__corner' },
    createSlowMotionButton(onSlowMotionToggle), createAutoPauseButton(onAutoPauseToggle, isAutoPauseAvailable));
  const element = createElement('div', { className: 'top-bar' }, leaveButton, scoreboard.element, corner);
  return { element, corner, update: scoreboard.update, setClockState: scoreboard.setClockState };
}

// Laid out like a broadcast scoreboard: the two teams mirrored around the kill score, the clock under it.
function createScoreboard({ playerSide, onSpeedChange, onPauseToggle }) {
  const teamStats = { [TEAM.BLUE]: createTeamStats(TEAM.BLUE, playerSide), [TEAM.RED]: createTeamStats(TEAM.RED, playerSide) };
  const kills = { [TEAM.BLUE]: createKills(TEAM.BLUE), [TEAM.RED]: createKills(TEAM.RED) };
  const clockControls = createClockControls({ onSpeedChange, onPauseToggle });
  const element = createElement('div', { className: 'scoreboard' },
    teamStats[TEAM.BLUE].element,
    createElement('div', { className: 'scoreboard__center' },
      kills[TEAM.BLUE], createElement('span', { className: 'scoreboard__divider', text: '—' }), kills[TEAM.RED]),
    clockControls.element,
    teamStats[TEAM.RED].element,
  );

  function update(gameState) {
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      teamStats[team].update(gameState);
      kills[team].textContent = String(gameState.teams[team].kills);
    }
    clockControls.showTime(gameState.gameSeconds);
  }

  return { element, update, setClockState: clockControls.setClockState };
}

function createKills(team) {
  return createElement('span', { className: `scoreboard__kills scoreboard__kills--${team}` });
}

// One team's half, read from the outside in: name, towers, gold on top; "You", drakes, grubs below.
function createTeamStats(team, playerSide) {
  const values = { towers: createStatValue(), gold: createStatValue(), grubs: createStatValue() };
  const drakeSlots = Array.from({ length: DRAKES_FOR_SOUL }, () => createElement('span', { className: 'drake-slot' }));
  const element = createElement('div', { className: `scoreboard__team scoreboard__team--${team}` },
    createElement('span', { className: 'scoreboard__team-name', text: TEAM_LABELS[team].toUpperCase() }),
    createStat('tower', 'Towers destroyed', values.towers, 'stat--towers'),
    createStat('gold', 'Total gold', values.gold, 'stat--gold'),
    team === playerSide ? createElement('span', { className: 'scoreboard__you', text: 'You' }) : null,
    createElement('span', { className: 'drake-slots', attributes: { title: 'Drakes' } }, ...drakeSlots),
    createStat('grub', 'Void grubs', values.grubs, 'stat--grubs'),
  );

  // A drake slot takes the colour of the element of the drake taken in that slot.
  function update(gameState) {
    const teamState = gameState.teams[team];
    values.towers.textContent = String(destroyedEnemyTowerCount(gameState, team));
    values.gold.textContent = formatGold(totalTeamGold(teamState));
    values.grubs.textContent = String(teamState.voidGrubs);
    drakeSlots.forEach((slot, index) => {
      slot.dataset.element = teamState.drakes[index] ?? '';
    });
  }

  return { element, update };
}

// Pause, the game time and the game speeds, under the kill score. While paused, the time itself is
// shown as the blinking "paused" pill; there is no room for a separate one, so the word is kept
// as visually hidden text for screen readers.
function createClockControls({ onSpeedChange, onPauseToggle }) {
  const timer = createElement('span', { className: 'scoreboard__timer' });
  const pausedText = createElement('span', { className: 'visually-hidden', text: 'Paused' });
  const pauseButton = createButton('', onPauseToggle, 'speed-button speed-button--pause');
  pauseButton.dataset.anchor = 'pause';
  const speedButtons = GAME_SPEEDS.map((speed, speedIndex) => createSpeedButton(speed, GAME_SPEED_KEYS[speedIndex], onSpeedChange));
  const element = createElement('div', { className: 'scoreboard__clock', dataset: { anchor: 'clock' } },
    pauseButton,
    createElement('span', { className: 'scoreboard__time' }, pausedText, timer),
    createElement('div', { className: 'speed-buttons' }, ...speedButtons),
  );

  // Only pauses the player can lift show as "Paused"; tutorial halts are shown by the tutorial itself.
  function setClockState({ speed, pauseReasons }) {
    const isUserPaused = pauseReasons.includes(PAUSE_REASON.USER);
    const showsPaused = isUserPaused || pauseReasons.includes(PAUSE_REASON.DIALOG);
    showPauseButtonState(pauseButton, isUserPaused);
    for (const button of speedButtons) {
      button.classList.toggle('is-active', Number(button.dataset.speed) === speed);
    }
    pausedText.hidden = !showsPaused;
    element.classList.toggle('is-paused', showsPaused);
  }

  setClockState({ speed: DEFAULT_GAME_SPEED, pauseReasons: [] });
  return { element, setClockState, showTime: gameSeconds => { timer.textContent = formatGameTime(gameSeconds); } };
}

function showPauseButtonState(pauseButton, isUserPaused) {
  pauseButton.innerHTML = isUserPaused ? ICONS.play : ICONS.pause;
  pauseButton.classList.toggle('is-active', isUserPaused);
  pauseButton.setAttribute('aria-pressed', String(isUserPaused));
  pauseButton.setAttribute('aria-label', isUserPaused ? 'Resume' : 'Pause');
  pauseButton.title = isUserPaused ? 'Resume (Space)' : 'Pause (Space)';
}

function createSpeedButton(speed, key, onSpeedChange) {
  const button = createButton(`${speed}x`, () => onSpeedChange(speed), 'speed-button');
  button.dataset.speed = String(speed);
  button.title = `Speed ${speed}x (key ${key})`;
  return button;
}

function createSlowMotionButton(onSlowMotionToggle) {
  return createToggleButton({ label: 'Slow-mo', title: 'Slow down on important moments', anchor: 'slow-motion', isInitiallyOn: true, onToggle: onSlowMotionToggle });
}

function createAutoPauseButton(onAutoPauseToggle, isAvailable) {
  return createToggleButton({
    label: 'Auto-pause',
    title: 'Pause on important moments, so you can give your calls',
    anchor: 'auto-pause',
    isInitiallyOn: false,
    onToggle: onAutoPauseToggle,
    unavailableReason: isAvailable ? null : 'Not in the guided game: the guide decides when the game stands still',
  });
}

// An unavailable toggle uses aria-disabled rather than disabled, so it can still be focused and
// hovered: the player can read why it is off, and screen readers say it is unavailable.
function createToggleButton({ label, title, anchor, isInitiallyOn, onToggle, unavailableReason = null }) {
  const button = createButton(label, () => {
    if (unavailableReason) {
      return;
    }
    const isEnabled = !button.classList.contains('is-active');
    button.classList.toggle('is-active', isEnabled);
    button.setAttribute('aria-pressed', String(isEnabled));
    onToggle(isEnabled);
  }, `speed-button speed-button--toggle${isInitiallyOn ? ' is-active' : ''}`);
  button.title = unavailableReason ?? title;
  button.dataset.anchor = anchor;
  button.setAttribute('aria-pressed', String(isInitiallyOn));
  if (unavailableReason) {
    button.setAttribute('aria-disabled', 'true');
  }
  return button;
}

function createStatValue() {
  return createElement('span', { className: 'stat__value' });
}

function createStat(iconName, title, valueElement, modifier) {
  const icon = createElement('span', { className: 'stat__icon' });
  icon.innerHTML = ICONS[iconName];
  return createElement('span', { className: `stat ${modifier}`, attributes: { title } }, icon, valueElement);
}

function formatGold(gold) {
  return `${(gold / GOLD_PER_THOUSAND).toFixed(1)}K`;
}
