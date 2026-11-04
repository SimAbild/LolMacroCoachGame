import { createButton, createElement, createImage } from '../ui/dom.js';
import { TEAM, TEAM_LABELS, opposingTeam } from '../config/teams.js';
import { DRAFT_ACTION, PICKS_PER_TEAM, banLabelsFor, phaseNameForStep } from '../config/draftOrder.js';
import { ROLES, ROLE_LABELS, ROLE_SHORT_LABELS } from '../config/roles.js';
import { DraftState } from '../draft/draftState.js';
import { DraftAi } from '../draft/draftAi.js';
import { createLoadoutFromRoleMap, createLoadoutWithAutomaticRoles } from '../draft/teamLoadout.js';
import { createLoadoutPanel } from './draft/loadoutPanel.js';
import { mountGameScreen } from './gameScreen.js';

const AI_THINKING_MS = 900;
const SCREEN_PHASE = Object.freeze({ DRAFT: 'draft', SWAP: 'swap' });
const BLUE_BAN_DISPLAY_ORDER = Object.freeze([0, 1, 2, null, 3, 4]);
const RED_BAN_DISPLAY_ORDER = Object.freeze([4, 3, null, 2, 1, 0]);

export function mountDraftScreen(root, { router, championPool, playerSide }) {
  const aiTeam = opposingTeam(playerSide);
  const draftState = new DraftState(championPool.champions);
  const draftAi = new DraftAi(aiTeam);
  const view = {
    screenPhase: SCREEN_PHASE.DRAFT,
    selectedChampionId: null,
    roleFilter: null,
    searchText: '',
    loadouts: null,
  };
  let aiTimer = null;

  const phaseLabel = createElement('div', { className: 'draft-phase-label' });
  const pickSlots = { [TEAM.BLUE]: createPickSlots(TEAM.BLUE), [TEAM.RED]: createPickSlots(TEAM.RED) };
  const banSlots = { [TEAM.BLUE]: createBanSlots(TEAM.BLUE), [TEAM.RED]: createBanSlots(TEAM.RED) };
  const championTiles = new Map();
  const championGrid = createElement('div', { className: 'champion-grid' });
  const roleFilterButtons = new Map();
  const championPicker = createElement('div', { className: 'champion-picker' },
    createPickerToolbar(),
    championGrid,
  );
  const loadoutPanel = createLoadoutPanel({
    version: championPool.version,
    onLoadoutChange: changedLoadout => {
      view.loadouts[playerSide] = changedLoadout;
      render();
    },
  });
  const centerArea = createElement('div', { className: 'draft-center' }, championPicker);
  const primaryButton = createButton('Lock in', onPrimaryButtonClick, 'button button--lock');

  for (const champion of championPool.champions) {
    const tile = createChampionTile(champion);
    championTiles.set(champion.id, tile);
    championGrid.append(tile);
  }

  root.append(createElement('section', { className: 'draft-screen', dataset: { playerSide } },
    createElement('header', { className: 'draft-header' },
      createTeamBanner(TEAM.BLUE),
      phaseLabel,
      createTeamBanner(TEAM.RED),
    ),
    createElement('div', { className: 'draft-body' },
      createElement('div', { className: 'pick-column pick-column--blue' }, ...pickSlots[TEAM.BLUE]),
      centerArea,
      createElement('div', { className: 'pick-column pick-column--red' }, ...pickSlots[TEAM.RED]),
    ),
    createElement('footer', { className: 'draft-footer' },
      createBanRow(TEAM.BLUE, BLUE_BAN_DISPLAY_ORDER),
      primaryButton,
      createBanRow(TEAM.RED, RED_BAN_DISPLAY_ORDER),
    ),
  ));

  render();
  scheduleAiTurnIfNeeded();

  return () => clearTimeout(aiTimer);

  function createTeamBanner(team) {
    const youSuffix = team === playerSide ? ' (you)' : '';
    return createElement('div', { className: `team-banner team-banner--${team}`, text: `${TEAM_LABELS[team]}${youSuffix}` });
  }

  function createPickSlots(team) {
    return Array.from({ length: PICKS_PER_TEAM }, (_, slotIndex) => createElement('div', {
      className: `pick-slot pick-slot--${team}`,
      dataset: { label: `${team === TEAM.BLUE ? 'B' : 'R'}${slotIndex + 1}` },
    }));
  }

  function createBanSlots(team) {
    return banLabelsFor(team).map(label => createElement('div', { className: `ban-slot ban-slot--${team}`, dataset: { label } }));
  }

  function createBanRow(team, displayOrder) {
    const row = createElement('div', { className: `ban-row ban-row--${team}` });
    for (const slotIndex of displayOrder) {
      row.append(slotIndex === null ? createElement('div', { className: 'ban-row__gap' }) : banSlots[team][slotIndex]);
    }
    return row;
  }

  function createPickerToolbar() {
    const roleFilters = createElement('div', { className: 'role-filters' });
    for (const role of ROLES) {
      const button = createButton(ROLE_SHORT_LABELS[role], () => {
        view.roleFilter = view.roleFilter === role ? null : role;
        render();
      }, 'role-filter');
      button.title = ROLE_LABELS[role];
      roleFilterButtons.set(role, button);
      roleFilters.append(button);
    }
    const searchInput = createElement('input', {
      className: 'champion-search',
      attributes: { type: 'search', placeholder: 'Search champion', 'aria-label': 'Search champion' },
    });
    searchInput.addEventListener('input', () => {
      view.searchText = searchInput.value.trim().toLowerCase();
      render();
    });
    return createElement('div', { className: 'picker-toolbar' }, roleFilters, searchInput);
  }

  function createChampionTile(champion) {
    const tile = createElement('button', {
      className: 'champion-tile',
      attributes: { type: 'button', title: champion.name },
    },
    createImage(champion.iconUrl, champion.name, 'champion-tile__icon'),
    createElement('span', { className: 'champion-tile__name', text: champion.name }),
    );
    tile.addEventListener('click', () => {
      if (isPlayersTurn() && draftState.isChampionAvailable(champion.id)) {
        view.selectedChampionId = champion.id;
        render();
      }
    });
    tile.addEventListener('dblclick', () => {
      if (view.selectedChampionId === champion.id) {
        lockInPlayerSelection();
      }
    });
    return tile;
  }

  function isPlayersTurn() {
    return view.screenPhase === SCREEN_PHASE.DRAFT && draftState.currentStep?.team === playerSide;
  }

  function onPrimaryButtonClick() {
    if (view.screenPhase === SCREEN_PHASE.SWAP) {
      router.show(mountGameScreen, { championPool, playerSide, loadouts: view.loadouts });
      return;
    }
    lockInPlayerSelection();
  }

  function lockInPlayerSelection() {
    if (!isPlayersTurn() || !view.selectedChampionId) {
      return;
    }
    draftState.lockIn(view.selectedChampionId);
    view.selectedChampionId = null;
    afterLockIn();
  }

  function scheduleAiTurnIfNeeded() {
    if (draftState.isComplete || draftState.currentStep.team !== aiTeam) {
      return;
    }
    aiTimer = setTimeout(() => {
      draftState.lockIn(draftAi.chooseChampion(draftState).id);
      afterLockIn();
    }, AI_THINKING_MS);
  }

  function afterLockIn() {
    if (draftState.isComplete) {
      enterSwapPhase();
    }
    render();
    scheduleAiTurnIfNeeded();
  }

  function enterSwapPhase() {
    view.screenPhase = SCREEN_PHASE.SWAP;
    view.loadouts = {
      [playerSide]: createLoadoutWithAutomaticRoles(draftState.picksFor(playerSide)),
      [aiTeam]: createLoadoutFromRoleMap(draftState.picksFor(aiTeam), draftAi.roleByChampionId),
    };
    centerArea.replaceChildren(loadoutPanel.element);
  }

  function render() {
    renderPhaseLabel();
    renderBanSlots();
    renderPickSlots();
    renderChampionGrid();
    renderPrimaryButton();
    if (view.screenPhase === SCREEN_PHASE.SWAP) {
      loadoutPanel.render(view.loadouts[playerSide]);
    }
  }

  function renderPhaseLabel() {
    if (view.screenPhase === SCREEN_PHASE.SWAP) {
      phaseLabel.textContent = 'Swap phase · set roles, builds and summoners';
      return;
    }
    const { team, action } = draftState.currentStep;
    const verb = action === DRAFT_ACTION.BAN ? 'banning' : 'picking';
    const youSuffix = team === playerSide ? ' (you)' : '';
    phaseLabel.textContent = `${phaseNameForStep(draftState.stepIndex)} · ${TEAM_LABELS[team]}${youSuffix} ${verb}`;
    phaseLabel.dataset.team = team;
  }

  function renderBanSlots() {
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      const bans = draftState.bansFor(team);
      banSlots[team].forEach((slot, slotIndex) => {
        const champion = bans[slotIndex] ?? previewChampionFor(team, DRAFT_ACTION.BAN, slotIndex);
        fillSlot(slot, champion, { isPreview: !bans[slotIndex] && Boolean(champion) });
        slot.classList.toggle('is-active', isActiveSlot(team, DRAFT_ACTION.BAN, slotIndex));
      });
    }
  }

  function renderPickSlots() {
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      pickSlots[team].forEach((slot, slotIndex) => {
        if (view.screenPhase === SCREEN_PHASE.SWAP) {
          const entry = view.loadouts[team][slotIndex];
          fillSlot(slot, entry.champion, { roleLabel: ROLE_LABELS[entry.role] });
          slot.classList.remove('is-active');
          return;
        }
        const pickedChampion = draftState.picksFor(team)[slotIndex];
        const champion = pickedChampion ?? previewChampionFor(team, DRAFT_ACTION.PICK, slotIndex);
        fillSlot(slot, champion, { isPreview: !pickedChampion && Boolean(champion) });
        slot.classList.toggle('is-active', isActiveSlot(team, DRAFT_ACTION.PICK, slotIndex));
      });
    }
  }

  function isActiveSlot(team, action, slotIndex) {
    const step = draftState.currentStep;
    return Boolean(step) && step.team === team && step.action === action && step.slotIndex === slotIndex;
  }

  function previewChampionFor(team, action, slotIndex) {
    if (!isActiveSlot(team, action, slotIndex) || team !== playerSide || !view.selectedChampionId) {
      return null;
    }
    return championPool.champions.find(champion => champion.id === view.selectedChampionId);
  }

  function renderChampionGrid() {
    for (const champion of championPool.champions) {
      const tile = championTiles.get(champion.id);
      tile.classList.toggle('is-unavailable', !draftState.isChampionAvailable(champion.id));
      tile.classList.toggle('is-selected', champion.id === view.selectedChampionId);
      tile.hidden = !matchesFilters(champion);
    }
    for (const [role, button] of roleFilterButtons) {
      button.classList.toggle('is-active', role === view.roleFilter);
    }
  }

  function matchesFilters(champion) {
    const matchesRole = !view.roleFilter || champion.roles.includes(view.roleFilter);
    const matchesSearch = !view.searchText || champion.name.toLowerCase().includes(view.searchText);
    return matchesRole && matchesSearch;
  }

  function renderPrimaryButton() {
    if (view.screenPhase === SCREEN_PHASE.SWAP) {
      primaryButton.textContent = 'Start game';
      primaryButton.disabled = false;
      return;
    }
    if (!isPlayersTurn()) {
      primaryButton.textContent = 'Enemy is choosing…';
      primaryButton.disabled = true;
      return;
    }
    primaryButton.textContent = draftState.currentStep.action === DRAFT_ACTION.BAN ? 'Ban' : 'Lock in';
    primaryButton.disabled = !view.selectedChampionId;
  }
}

function fillSlot(slot, champion, { isPreview = false, roleLabel = '' } = {}) {
  slot.classList.toggle('is-filled', Boolean(champion));
  slot.classList.toggle('is-preview', isPreview);
  slot.replaceChildren();
  if (!champion) {
    slot.append(createElement('span', { className: 'slot-label', text: slot.dataset.label }));
    return;
  }
  slot.append(
    createImage(champion.iconUrl, champion.name, 'slot-icon'),
    createElement('span', { className: 'slot-name', text: champion.name }),
  );
  if (roleLabel) {
    slot.append(createElement('span', { className: 'slot-role', text: roleLabel }));
  }
}
