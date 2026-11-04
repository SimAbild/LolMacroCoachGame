import { createButton, createElement, createImage } from '../../ui/dom.js';
import { ROLE_LABELS } from '../../config/roles.js';
import { BUILD_TYPES, buildTypesAvailableForRole } from '../../config/buildTypes.js';
import { SUMMONER_SPELLS, SUMMONER_SPELL_IDS } from '../../config/summonerSpells.js';
import { summonerSpellIconUrl } from '../../data/dataDragon.js';
import { swapChampions } from '../../draft/teamLoadout.js';

export function createLoadoutPanel({ version, onLoadoutChange }) {
  const rowsContainer = createElement('div', { className: 'loadout-rows' });
  const element = createElement('div', { className: 'loadout-panel' },
    createElement('div', { className: 'loadout-panel__header' },
      createElement('h2', { text: 'Swap phase' }),
      createElement('p', { className: 'muted', text: 'Move champions to their roles, then choose build and summoner spells. Runes follow the build.' }),
    ),
    rowsContainer,
  );

  let currentLoadout = [];

  function render(loadout) {
    currentLoadout = loadout;
    rowsContainer.replaceChildren(...loadout.map((entry, index) => createRow(entry, index)));
  }

  function changeEntry(index, changes) {
    const changedLoadout = currentLoadout.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...changes } : entry));
    onLoadoutChange(changedLoadout);
  }

  function createRow(entry, index) {
    return createElement('div', { className: 'loadout-row' },
      createElement('span', { className: 'loadout-row__role', text: ROLE_LABELS[entry.role] }),
      createElement('div', { className: 'loadout-row__champion' },
        createImage(entry.champion.iconUrl, entry.champion.name, 'loadout-row__icon'),
        createElement('span', { text: entry.champion.name }),
      ),
      createSwapButtons(index),
      createBuildSelector(entry, index),
      createSummonerSelectors(entry, index),
    );
  }

  function createSwapButtons(index) {
    const moveUpButton = createButton('▲', () => onLoadoutChange(swapChampions(currentLoadout, index, index - 1)), 'icon-button');
    const moveDownButton = createButton('▼', () => onLoadoutChange(swapChampions(currentLoadout, index, index + 1)), 'icon-button');
    moveUpButton.disabled = index === 0;
    moveDownButton.disabled = index === currentLoadout.length - 1;
    moveUpButton.setAttribute('aria-label', 'Move champion up one role');
    moveDownButton.setAttribute('aria-label', 'Move champion down one role');
    return createElement('div', { className: 'loadout-row__swap' }, moveUpButton, moveDownButton);
  }

  function createBuildSelector(entry, index) {
    const buttons = buildTypesAvailableForRole(entry.role).map(buildType => {
      const button = createButton(BUILD_TYPES[buildType].label, () => changeEntry(index, { buildType }), 'segment');
      button.classList.toggle('is-active', buildType === entry.buildType);
      return button;
    });
    return createElement('div', { className: 'loadout-row__build' },
      createElement('div', { className: 'segments' }, ...buttons),
      createElement('span', { className: 'loadout-row__runes', text: BUILD_TYPES[entry.buildType].runePreset }),
    );
  }

  function createSummonerSelectors(entry, index) {
    const selectors = entry.summonerSpells.map((spellId, spellSlot) => {
      const select = createElement('select', { className: 'summoner-select', attributes: { 'aria-label': `Summoner spell ${spellSlot + 1}` } });
      for (const optionSpellId of SUMMONER_SPELL_IDS) {
        const option = createElement('option', { text: SUMMONER_SPELLS[optionSpellId].label, attributes: { value: optionSpellId } });
        option.selected = optionSpellId === spellId;
        select.append(option);
      }
      select.addEventListener('change', () => {
        changeEntry(index, { summonerSpells: chooseSummonerSpell(entry.summonerSpells, spellSlot, select.value) });
      });
      return createElement('label', { className: 'summoner-picker' },
        createImage(summonerSpellIconUrl(version, SUMMONER_SPELLS[spellId].iconId), SUMMONER_SPELLS[spellId].label, 'summoner-picker__icon'),
        select,
      );
    });
    return createElement('div', { className: 'loadout-row__summoners' }, ...selectors);
  }

  return { element, render };
}

function chooseSummonerSpell(currentSpells, spellSlot, newSpellId) {
  const otherSlot = spellSlot === 0 ? 1 : 0;
  const changedSpells = [...currentSpells];
  if (changedSpells[otherSlot] === newSpellId) {
    changedSpells[otherSlot] = changedSpells[spellSlot];
  }
  changedSpells[spellSlot] = newSpellId;
  return changedSpells;
}
