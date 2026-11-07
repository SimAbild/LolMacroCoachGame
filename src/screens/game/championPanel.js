import { createButton, createElement, createImage } from '../../ui/dom.js';
import { attachTooltip } from '../../ui/tooltip.js';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';
import { CALL_HELP_ACTION_ID, ROLE_ACTIONS, describeHelpRequest } from '../../config/actions.js';
import { INTENT } from '../../core/intents.js';
import { SUMMONER_SPELLS } from '../../config/summonerSpells.js';
import { summonerSpellIconUrl } from '../../data/dataDragon.js';
import { ITEM_SLOTS } from '../../game/gameState.js';
import { describeActivity } from '../../game/activities.js';

const RESOURCE_BAR_CLASS = Object.freeze({ Mana: 'bar--mana', Energy: 'bar--energy' });
const PERCENT = 100;

// onIntent receives plain intent objects (see src/core/intents.js) for every button on the card.
export function createChampionPanel(championState, { version, itemCatalog, isOwnTeam, onIntent, onActionHover }) {
  const { role } = championState;
  const levelBadge = createElement('span', { className: 'level-badge' });
  const goldLabel = createElement('span', { className: 'champion-panel__gold' });
  const healthFill = createElement('div', { className: 'bar__fill' });
  const resourceFill = createElement('div', { className: 'bar__fill' });
  const statusText = createElement('span', { className: 'champion-card__status-text' });
  const cancelButton = createButton('✕', () => onIntent({ type: INTENT.CANCEL_ACTION, role }), 'cancel-action');
  cancelButton.dataset.anchor = 'cancel';
  cancelButton.setAttribute('aria-label', 'Cancel call');
  attachTooltip(cancelButton, { title: 'Cancel call', body: 'Stop the current call. The champion goes back to laning or farming.' });
  const statusLine = createElement('div', { className: 'champion-card__status' }, statusText, cancelButton);
  const resourceBarClass = RESOURCE_BAR_CLASS[championState.champion.resourceType] ?? 'bar--other';
  const itemSlots = createItemSlots();
  const summonerIcons = createSummonerIcons(championState, version);
  const ultimateBadge = createElement('span', { className: 'ultimate-badge', text: 'R' });

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
        ultimateBadge,
        summonerIcons.element,
        itemSlots.element,
      ),
    ),
  );

  const card = createElement('div', {
    className: `champion-card champion-card--${championState.team}${isOwnTeam ? ' is-own' : ''}`,
    dataset: { role, team: championState.team },
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
    const ultimateCooldown = displayedState.ultimateCooldownSeconds ?? 0;
    ultimateBadge.classList.toggle('is-on-cooldown', ultimateCooldown > 0);
    ultimateBadge.title = ultimateCooldown > 0 ? `Ultimate (${Math.ceil(ultimateCooldown)}s)` : 'Ultimate ready';
    card.classList.toggle('is-dead', !displayedState.isAlive);
    card.classList.toggle('is-in-fog', !isOwnTeam && !displayedState.isVisibleToPlayer);
  }

  function createActionControls() {
    const helpTargets = createElement('div', { className: 'help-targets' });
    let callHelpChip = null;
    const setHelpTargetsOpen = isOpen => {
      helpTargets.hidden = !isOpen;
      callHelpChip?.setAttribute('aria-expanded', String(isOpen));
    };

    for (const helperRole of ROLES.filter(otherRole => otherRole !== role)) {
      const chip = createActionChip(`with ${ROLE_LABELS[helperRole]}`, helperRole, () => {
        setHelpTargetsOpen(false);
        onIntent({ type: INTENT.CHAMPION_ACTION, role, actionId: CALL_HELP_ACTION_ID, helperRole });
      });
      chip.dataset.helperRole = helperRole;
      attachTooltip(chip, { title: `Call help: ${ROLE_LABELS[helperRole]}`, body: describeHelpRequest(role, helperRole) });
      helpTargets.append(chip);
    }

    const actionChips = createElement('div', { className: 'action-chips' });
    for (const action of ROLE_ACTIONS[role]) {
      const isCallHelp = action.id === CALL_HELP_ACTION_ID;
      const chip = createActionChip(action.label, action.targetRole, () => {
        if (isCallHelp) {
          setHelpTargetsOpen(helpTargets.hidden);
          return;
        }
        onIntent({ type: INTENT.CHAMPION_ACTION, role, actionId: action.id });
      });
      chip.dataset.actionId = action.id;
      attachTooltip(chip, { title: action.label, body: action.description });
      if (isCallHelp) {
        callHelpChip = chip;
      }
      actionChips.append(chip);
    }
    setHelpTargetsOpen(false);
    return [actionChips, helpTargets];
  }

  // Chips that involve another role also draw the coordination link to that role's card on hover.
  function createActionChip(label, linkedRole, onClick) {
    const chip = createElement('button', { className: 'action-chip', text: label, attributes: { type: 'button' } });
    chip.addEventListener('click', onClick);
    if (linkedRole) {
      chip.addEventListener('mouseenter', () => onActionHover(championState, linkedRole));
      chip.addEventListener('mouseleave', () => onActionHover(championState, null));
      chip.addEventListener('focus', () => onActionHover(championState, linkedRole));
      chip.addEventListener('blur', () => onActionHover(championState, null));
    }
    return chip;
  }

  return { element: card, update };
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
  const trinketSlot = createElement('span', { className: 'item-slot item-slot--trinket', attributes: { title: 'Ward trinket' }, dataset: { anchor: 'trinket' } });
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
