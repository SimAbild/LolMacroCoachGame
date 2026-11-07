import { createButton, createElement, createImage } from '../../ui/dom.js';
import { ROLES, ROLE_LABELS, ROLE_SHORT_LABELS } from '../../config/roles.js';

// The champion grid with role filters and a search box. A click asks to select a champion,
// a double-click asks to lock it in; the draft screen decides whether that is allowed.
export function createChampionPicker({ champions, onSelect, onLockIn }) {
  const filters = { role: null, searchText: '' };
  const tilesById = new Map();
  const roleFilterButtons = new Map();
  const grid = createElement('div', { className: 'champion-grid' });
  for (const champion of champions) {
    const tile = createChampionTile(champion, { onSelect, onLockIn });
    tilesById.set(champion.id, tile);
    grid.append(tile);
  }
  const element = createElement('div', { className: 'champion-picker' }, createToolbar(), grid);
  let lastDraftView = null;

  // draftView is { isChampionAvailable(id), selectedChampionId }.
  function render(draftView) {
    lastDraftView = draftView;
    for (const champion of champions) {
      const tile = tilesById.get(champion.id);
      tile.classList.toggle('is-unavailable', !draftView.isChampionAvailable(champion.id));
      tile.classList.toggle('is-selected', champion.id === draftView.selectedChampionId);
      tile.hidden = !matchesFilters(champion, filters);
    }
    for (const [role, button] of roleFilterButtons) {
      button.classList.toggle('is-active', role === filters.role);
    }
  }

  function createToolbar() {
    const roleFilters = createElement('div', { className: 'role-filters' }, ...ROLES.map(createRoleFilter));
    const searchInput = createElement('input', {
      className: 'champion-search',
      attributes: { type: 'search', placeholder: 'Search champion', 'aria-label': 'Search champion' },
    });
    searchInput.addEventListener('input', () => {
      filters.searchText = searchInput.value.trim().toLowerCase();
      render(lastDraftView);
    });
    return createElement('div', { className: 'picker-toolbar' }, roleFilters, searchInput);
  }

  function createRoleFilter(role) {
    const button = createButton(ROLE_SHORT_LABELS[role], () => {
      filters.role = filters.role === role ? null : role;
      render(lastDraftView);
    }, 'role-filter');
    button.title = ROLE_LABELS[role];
    roleFilterButtons.set(role, button);
    return button;
  }

  return { element, render };
}

function createChampionTile(champion, { onSelect, onLockIn }) {
  const tile = createElement('button', {
    className: 'champion-tile',
    attributes: { type: 'button', title: champion.name },
    dataset: { championId: champion.id },
  },
  createImage(champion.iconUrl, champion.name, 'champion-tile__icon'),
  createElement('span', { className: 'champion-tile__name', text: champion.name }),
  );
  tile.addEventListener('click', () => onSelect(champion.id));
  tile.addEventListener('dblclick', () => onLockIn(champion.id));
  return tile;
}

function matchesFilters(champion, filters) {
  const matchesRole = !filters.role || champion.roles.includes(filters.role);
  const matchesSearch = !filters.searchText || champion.name.toLowerCase().includes(filters.searchText);
  return matchesRole && matchesSearch;
}
