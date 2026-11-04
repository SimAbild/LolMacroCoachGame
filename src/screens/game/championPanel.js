import { createButton, createElement, createImage } from '../../ui/dom.js';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';
import { CALL_HELP_ACTION_ID, ROLE_ACTIONS } from '../../config/actions.js';
import { SUMMONER_SPELLS } from '../../config/summonerSpells.js';
import { summonerSpellIconUrl } from '../../data/dataDragon.js';
import { ITEM_SLOTS } from '../../game/gameState.js';
import { describeActivity } from '../../game/activities.js';

const RESOURCE_BAR_CLASS = Object.freeze({ Mana: 'bar--mana', Energy: 'bar--energy' });
const PERCENT = 100;

export function createChampionPanel(championState, { version, itemCatalog, isOwnTeam, onAction, onCancelAction, onActionHover }) {
  const levelBadge = createElement('span', { className: 'level-badge' });
  const goldLabel = createElement('span', { className: 'champion-panel__gold' });
  const healthFill = createElement('div', { className: 'bar__fill' });
  const resourceFill = createElement('div', { className: 'bar__fill' });
  const statusText = createElement('span', { className: 'champion-card__status-text' });
  const cancelButton = createButton('✕', () => onCancelAction(championState), 'cancel-action');
  cancelButton.title = 'Cancel call';
  cancelButton.setAttribute('aria-label', 'Cancel call');
  const statusLine = createElement('div', { className: 'champion-card__status' }, statusText, cancelButton);
  const resourceBarClass = RESOURCE_BAR_CLASS[championState.champion.resourceType] ?? 'bar--other';
  const itemSlots = createItemSlots();
  const summonerIcons = createSummonerIcons(championState, version);

  const panel = createElement('div', { className: 'champion-panel' },
    createElement('div', { className: 'champion-panel__portrait' },
      createImage(championState.champion.iconUrl, championState.champion.name, 'champion-panel__icon'),
      levelBadge,
    ),
    createElement('div', { className: 'champion-panel__main' },
      createElement('div', { className: 'champion-panel__title' },
        createElement('span', { className: 'champion-panel__name', text: championState.champion.name }),
        createElement('span', { className: 'champion-panel__role', text: ROLE_LABELS[championState.role] }),
        isOwnTeam ? goldLabel : null,
      ),
      createElement('div', { className: 'bar bar--health' }, healthFill),
      createElement('div', { className: `bar ${resourceBarClass}` }, resourceFill),
      createElement('div', { className: 'champion-panel__loadout' },
        summonerIcons.element,
        itemSlots.element,
      ),
    ),
  );

  const card = createElement('div', {
    className: `champion-card champion-card--${championState.team}${isOwnTeam ? ' is-own' : ''}`,
    dataset: { role: championState.role },
  }, panel);

  if (isOwnTeam) {
    card.append(statusLine, ...createActionControls());
  }

  update(championState);

  function update(displayedState) {
    levelBadge.textContent = String(displayedState.level);
    goldLabel.textContent = String(Math.floor(displayedState.gold));
    healthFill.style.width = `${displayedState.healthRatio * PERCENT}%`;
    resourceFill.style.width = `${displayedState.resourceRatio * PERCENT}%`;
    statusText.textContent = describeActivity(displayedState);
    cancelButton.hidden = !displayedState.activeAction;
    itemSlots.update(displayedState.items, itemCatalog, isOwnTeam ? displayedState.trinketCharges : null);
    summonerIcons.update(displayedState.summonerSpells);
    card.classList.toggle('is-dead', !displayedState.isAlive);
    card.classList.toggle('is-in-fog', !isOwnTeam && !displayedState.isVisibleToPlayer);
  }

  function createActionControls() {
    const helpTargets = createElement('div', { className: 'help-targets' });
    helpTargets.hidden = true;
    const otherRoles = ROLES.filter(role => role !== championState.role);
    for (const targetRole of otherRoles) {
      const label = `with ${ROLE_LABELS[targetRole]}`;
      helpTargets.append(createActionChip({ label, targetRole }, () => {
        helpTargets.hidden = true;
        onAction(championState, callHelpDefinition(championState.role), { helperRole: targetRole });
      }));
    }
    const actionChips = createElement('div', { className: 'action-chips' });
    for (const action of ROLE_ACTIONS[championState.role]) {
      const isCallHelp = action.id === CALL_HELP_ACTION_ID;
      actionChips.append(createActionChip(action, () => {
        if (isCallHelp) {
          helpTargets.hidden = !helpTargets.hidden;
          return;
        }
        onAction(championState, action);
      }));
    }
    return [actionChips, helpTargets];
  }

  function createActionChip(action, onClick) {
    const chip = createElement('button', { className: 'action-chip', text: action.label, attributes: { type: 'button' } });
    chip.addEventListener('click', onClick);
    if (action.targetRole) {
      chip.addEventListener('mouseenter', () => onActionHover(championState, action.targetRole));
      chip.addEventListener('mouseleave', () => onActionHover(championState, null));
      chip.addEventListener('focus', () => onActionHover(championState, action.targetRole));
      chip.addEventListener('blur', () => onActionHover(championState, null));
    }
    return chip;
  }

  return { element: card, update };
}

function callHelpDefinition(role) {
  return ROLE_ACTIONS[role].find(action => action.id === CALL_HELP_ACTION_ID);
}

function createSummonerIcons(championState, version) {
  const icons = championState.summonerSpells.map(({ spellId }) => createImage(
    summonerSpellIconUrl(version, SUMMONER_SPELLS[spellId].iconId),
    SUMMONER_SPELLS[spellId].label,
    'summoner-icon',
  ));
  const element = createElement('div', { className: 'summoner-icons' }, ...icons);

  function update(summonerSpells) {
    icons.forEach((icon, index) => {
      const cooldownSeconds = summonerSpells[index]?.cooldownSeconds ?? 0;
      icon.classList.toggle('is-on-cooldown', cooldownSeconds > 0);
      icon.title = cooldownSeconds > 0
        ? `${SUMMONER_SPELLS[summonerSpells[index].spellId].label} (${Math.ceil(cooldownSeconds)}s)`
        : SUMMONER_SPELLS[summonerSpells[index].spellId].label;
    });
  }

  return { element, update };
}

function createItemSlots() {
  const slots = Array.from({ length: ITEM_SLOTS }, () => createElement('span', { className: 'item-slot' }));
  const trinketSlot = createElement('span', { className: 'item-slot item-slot--trinket', attributes: { title: 'Ward trinket' } });
  const element = createElement('div', { className: 'item-slots' }, ...slots, trinketSlot);
  const shownItemKeys = new Array(ITEM_SLOTS).fill('');

  function update(items, itemCatalog, trinketCharges) {
    if (trinketCharges !== null) {
      trinketSlot.textContent = String(trinketCharges);
      trinketSlot.title = `Ward trinket · ${trinketCharges} charges`;
    }
    slots.forEach((slot, slotIndex) => {
      const item = items[slotIndex];
      const itemKey = item ? `${item.itemId}:${Math.floor(item.paidGold)}` : '';
      if (itemKey === shownItemKeys[slotIndex]) {
        return;
      }
      shownItemKeys[slotIndex] = itemKey;
      fillItemSlot(slot, item, itemCatalog);
    });
  }

  return { element, update };
}

function fillItemSlot(slot, item, itemCatalog) {
  slot.replaceChildren();
  slot.classList.remove('is-partial');
  slot.removeAttribute('title');
  if (!item) {
    return;
  }
  const catalogItem = itemCatalog.get(item.itemId);
  const progressPercent = Math.round((item.paidGold / item.cost) * PERCENT);
  const isFinished = item.paidGold >= item.cost;
  slot.title = isFinished ? catalogItem.name : `${catalogItem.name} (${progressPercent}%)`;
  slot.classList.toggle('is-partial', !isFinished);
  slot.style.setProperty('--progress', `${progressPercent}%`);
  slot.append(createImage(catalogItem.iconUrl, catalogItem.name, 'item-slot__icon'));
}
