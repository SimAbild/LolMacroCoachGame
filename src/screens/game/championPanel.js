import { createButton, createElement, createImage } from '../../ui/dom.js';
import { attachTooltip } from '../../ui/tooltip.js';
import { ROLE_LABELS } from '../../config/roles.js';
import { INTENT } from '../../core/intents.js';
import { describeActivity } from '../../game/activities.js';
import { createActionControls } from './actionControls.js';
import { createItemSlots, createSummonerIcons, createUltimateBadge } from './loadoutIcons.js';

const RESOURCE_BAR_CLASS = Object.freeze({ Mana: 'bar--mana', Energy: 'bar--energy' });
const PERCENT = 100;

// One champion's card: portrait, bars and loadout for both teams; for the player's own team
// also gold, what the champion is doing, and the call buttons.
// onIntent receives plain intent objects (see src/core/intents.js) for every button on the card.
export function createChampionPanel(championState, { version, itemCatalog, isOwnTeam, onIntent, onActionHover }) {
  const parts = {
    levelBadge: createElement('span', { className: 'level-badge' }),
    goldLabel: createElement('span', { className: 'champion-panel__gold' }),
    creepScoreLabel: createElement('span', { className: 'champion-panel__cs', attributes: { title: 'Creep score: minions and camps killed' } }),
    healthFill: createElement('div', { className: 'bar__fill' }),
    resourceFill: createElement('div', { className: 'bar__fill' }),
    ultimateBadge: createUltimateBadge(),
    summonerIcons: createSummonerIcons(championState, version),
    itemSlots: createItemSlots({ itemCatalog, showsTrinketCharges: isOwnTeam }),
    status: createStatusLine(championState.role, onIntent),
  };
  const card = createElement('div', {
    className: `champion-card champion-card--${championState.team}${isOwnTeam ? ' is-own' : ''}`,
    dataset: { role: championState.role, team: championState.team },
  }, createPanel(championState, { parts, isOwnTeam }));
  if (isOwnTeam) {
    card.append(parts.status.element, ...createActionControls(championState, { onIntent, onActionHover }));
  }

  function update(displayedState) {
    parts.levelBadge.textContent = String(displayedState.level);
    parts.goldLabel.textContent = String(Math.floor(displayedState.gold));
    parts.creepScoreLabel.textContent = `${displayedState.creepScore} CS`;
    parts.healthFill.style.width = `${displayedState.healthRatio * PERCENT}%`;
    parts.resourceFill.style.width = `${displayedState.resourceRatio * PERCENT}%`;
    parts.status.update(displayedState);
    parts.itemSlots.update(displayedState);
    parts.summonerIcons.update(displayedState);
    parts.ultimateBadge.update(displayedState);
    card.classList.toggle('is-dead', !displayedState.isAlive);
    card.classList.toggle('is-in-fog', !isOwnTeam && !displayedState.isVisibleToPlayer);
  }

  update(championState);
  return { element: card, update };
}

function createPanel(championState, { parts, isOwnTeam }) {
  const resourceBarClass = RESOURCE_BAR_CLASS[championState.champion.resourceType] ?? 'bar--other';
  return createElement('div', { className: 'champion-panel' },
    createElement('div', { className: 'champion-panel__portrait' },
      createImage(championState.champion.iconUrl, championState.champion.name, 'champion-panel__icon'),
      parts.levelBadge,
    ),
    createElement('div', { className: 'champion-panel__main' },
      createElement('div', { className: 'champion-panel__title' },
        createElement('span', { className: 'champion-panel__name', text: championState.champion.name }),
        createElement('span', { className: 'champion-panel__role', text: ROLE_LABELS[championState.role] }),
        parts.creepScoreLabel,
        isOwnTeam ? parts.goldLabel : null,
      ),
      createElement('div', { className: 'bar bar--health' }, parts.healthFill),
      createElement('div', { className: `bar ${resourceBarClass}` }, parts.resourceFill),
      createElement('div', { className: 'champion-panel__loadout' },
        parts.ultimateBadge.element, parts.summonerIcons.element, parts.itemSlots.element),
    ),
  );
}

// What the champion is doing right now, with a ✕ to cancel the current call.
function createStatusLine(role, onIntent) {
  const statusText = createElement('span', { className: 'champion-card__status-text' });
  const cancelButton = createButton('✕', () => onIntent({ type: INTENT.CANCEL_ACTION, role }), 'cancel-action');
  cancelButton.dataset.anchor = 'cancel';
  cancelButton.setAttribute('aria-label', 'Cancel call');
  attachTooltip(cancelButton, { title: 'Cancel call', body: 'Stop the current call. The champion goes back to laning or farming.' });
  const element = createElement('div', { className: 'champion-card__status' }, statusText, cancelButton);

  function update(displayedState) {
    statusText.textContent = describeActivity(displayedState);
    cancelButton.hidden = !displayedState.activeAction;
  }

  return { element, update };
}
