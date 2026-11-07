import { createElement, createImage } from '../../ui/dom.js';
import { SUMMONER_SPELLS } from '../../config/summonerSpells.js';
import { summonerSpellIconUrl } from '../../data/dataDragon.js';
import { ITEM_SLOTS } from '../../game/gameState.js';

const PERCENT = 100;

// The small icons on a champion card: ultimate, summoner spells, items and the ward trinket.
// Each returns { element, update(displayedState) }.

export function createUltimateBadge() {
  const element = createElement('span', { className: 'ultimate-badge', text: 'R' });

  function update(displayedState) {
    const cooldownSeconds = displayedState.ultimateCooldownSeconds ?? 0;
    element.classList.toggle('is-on-cooldown', cooldownSeconds > 0);
    element.title = cooldownSeconds > 0 ? `Ultimate (${Math.ceil(cooldownSeconds)}s)` : 'Ultimate ready';
  }

  return { element, update };
}

export function createSummonerIcons(championState, version) {
  const icons = championState.summonerSpells.map(({ spellId }) => createImage(
    summonerSpellIconUrl(version, SUMMONER_SPELLS[spellId].iconId),
    SUMMONER_SPELLS[spellId].label,
    'summoner-icon',
  ));
  const element = createElement('div', { className: 'summoner-icons' }, ...icons);

  function update(displayedState) {
    icons.forEach((icon, index) => {
      const spell = displayedState.summonerSpells[index];
      const cooldownSeconds = spell?.cooldownSeconds ?? 0;
      const label = SUMMONER_SPELLS[spell.spellId].label;
      icon.classList.toggle('is-on-cooldown', cooldownSeconds > 0);
      icon.title = cooldownSeconds > 0 ? `${label} (${Math.ceil(cooldownSeconds)}s)` : label;
    });
  }

  return { element, update };
}

// Trinket charges are only known for the player's own champions; pass showsTrinketCharges false for enemies.
export function createItemSlots({ itemCatalog, showsTrinketCharges }) {
  const slots = Array.from({ length: ITEM_SLOTS }, () => createElement('span', { className: 'item-slot' }));
  const trinketSlot = createElement('span', { className: 'item-slot item-slot--trinket', attributes: { title: 'Ward trinket' }, dataset: { anchor: 'trinket' } });
  const element = createElement('div', { className: 'item-slots' }, ...slots, trinketSlot);
  // Items only change now and then, so a slot is only redrawn when its item or progress changed.
  const shownItemKeys = new Array(ITEM_SLOTS).fill('');

  function update(displayedState) {
    if (showsTrinketCharges) {
      trinketSlot.textContent = String(displayedState.trinketCharges);
      trinketSlot.title = `Ward trinket · ${displayedState.trinketCharges} charges`;
    }
    slots.forEach((slot, slotIndex) => {
      const item = displayedState.items[slotIndex];
      const itemKey = item ? `${item.itemId}:${Math.floor(item.paidGold)}` : '';
      if (itemKey !== shownItemKeys[slotIndex]) {
        shownItemKeys[slotIndex] = itemKey;
        fillItemSlot(slot, item, itemCatalog);
      }
    });
  }

  return { element, update };
}

// An item still being saved up for is shown grey with a gold progress bar along the bottom.
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
