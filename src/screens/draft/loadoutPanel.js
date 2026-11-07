import { createButton, createElement, createImage } from '../../ui/dom.js';
import { ROLE_LABELS } from '../../config/roles.js';
import { BUILD_TYPES, buildTypesAvailableForRole } from '../../config/buildTypes.js';
import { SUMMONER_SPELLS, SUMMONER_SPELL_IDS } from '../../config/summonerSpells.js';
import { summonerSpellIconUrl } from '../../data/dataDragon.js';
import { INTENT } from '../../core/intents.js';

// The swap phase: one row per role with the champion, swap arrows, build and summoner spells.
// It changes nothing itself: every change is sent to onIntent, and the screen renders the result.
// A change that is not allowed is undone simply by rendering the unchanged loadout again.
export function createLoadoutPanel({ version, onIntent }) {
  const rowsContainer = createElement('div', { className: 'loadout-rows' });
  const element = createElement('div', { className: 'loadout-panel' },
    createElement('div', { className: 'loadout-panel__header' },
      createElement('h2', { text: 'Swap phase' }),
      createElement('p', { className: 'muted', text: 'Move champions to their roles, then choose build and summoner spells. Runes follow the build.' }),
    ),
    rowsContainer,
  );

  function render(loadout) {
    rowsContainer.replaceChildren(...loadout.map((entry, index) => createRow(entry, { index, rowCount: loadout.length })));
  }

  function createRow(entry, { index, rowCount }) {
    return createElement('div', { className: 'loadout-row', dataset: { row: String(index), role: entry.role } },
      createElement('span', { className: 'loadout-row__role', text: ROLE_LABELS[entry.role] }),
      createElement('div', { className: 'loadout-row__champion' },
        createImage(entry.champion.iconUrl, entry.champion.name, 'loadout-row__icon'),
        createElement('span', { text: entry.champion.name }),
      ),
      createSwapButtons({ index, rowCount }),
      createBuildSelector(entry),
      createSummonerSelectors(entry),
    );
  }

  function createSwapButtons({ index, rowCount }) {
    const moveUpButton = createButton('▲', () => onIntent({ type: INTENT.LOADOUT_SWAP, fromIndex: index, toIndex: index - 1 }), 'icon-button');
    const moveDownButton = createButton('▼', () => onIntent({ type: INTENT.LOADOUT_SWAP, fromIndex: index, toIndex: index + 1 }), 'icon-button');
    moveUpButton.disabled = index === 0;
    moveDownButton.disabled = index === rowCount - 1;
    moveUpButton.dataset.swap = 'up';
    moveDownButton.dataset.swap = 'down';
    moveUpButton.setAttribute('aria-label', 'Move champion up one role');
    moveDownButton.setAttribute('aria-label', 'Move champion down one role');
    return createElement('div', { className: 'loadout-row__swap' }, moveUpButton, moveDownButton);
  }

  function createBuildSelector(entry) {
    const buttons = buildTypesAvailableForRole(entry.role).map(buildType => {
      const button = createButton(BUILD_TYPES[buildType].label, () => onIntent({ type: INTENT.LOADOUT_BUILD, role: entry.role, buildType }), 'segment');
      button.classList.toggle('is-active', buildType === entry.buildType);
      button.dataset.buildType = buildType;
      return button;
    });
    return createElement('div', { className: 'loadout-row__build' },
      createElement('div', { className: 'segments' }, ...buttons),
      createElement('span', { className: 'loadout-row__runes', text: BUILD_TYPES[entry.buildType].runePreset }),
    );
  }

  function createSummonerSelectors(entry) {
    const pickers = entry.summonerSpells.map((spellId, spellSlot) => {
      const select = createSpellSelect(spellId, spellSlot);
      select.addEventListener('change', () => onIntent({ type: INTENT.LOADOUT_SPELL, role: entry.role, spellSlot, spellId: select.value }));
      return createElement('label', { className: 'summoner-picker' },
        createImage(summonerSpellIconUrl(version, SUMMONER_SPELLS[spellId].iconId), SUMMONER_SPELLS[spellId].label, 'summoner-picker__icon'),
        select,
      );
    });
    return createElement('div', { className: 'loadout-row__summoners' }, ...pickers);
  }

  return { element, render };
}

function createSpellSelect(selectedSpellId, spellSlot) {
  const select = createElement('select', {
    className: 'summoner-select',
    attributes: { 'aria-label': `Summoner spell ${spellSlot + 1}` },
    dataset: { spellSlot: String(spellSlot) },
  });
  for (const spellId of SUMMONER_SPELL_IDS) {
    const option = createElement('option', { text: SUMMONER_SPELLS[spellId].label, attributes: { value: spellId } });
    option.selected = spellId === selectedSpellId;
    select.append(option);
  }
  return select;
}
