import { createButton, createElement } from '../ui/dom.js';
import { TEAM, opposingTeam } from '../config/teams.js';
import { DRAFT_ACTION } from '../config/draftOrder.js';
import { DraftState } from '../draft/draftState.js';
import { DraftAi } from '../draft/draftAi.js';
import { createLoadoutFromRoleMap, createLoadoutWithAutomaticRoles } from '../draft/teamLoadout.js';
import { createLoadoutPanel } from './draft/loadoutPanel.js';
import { createChampionPicker } from './draft/championPicker.js';
import { createDraftBoard } from './draft/draftBoard.js';
import { mountGameScreen } from './gameScreen.js';

const AI_THINKING_MS = 900;
const SCREEN_PHASE = Object.freeze({ DRAFT: 'draft', SWAP: 'swap' });

// The draft's flow: whose turn it is, the AI's turns, locking in, and the swap phase after it.
// The board, the picker and the loadout panel draw themselves from the state passed to them.
export function mountDraftScreen(root, { router, gameData, playerSide }) {
  const aiTeam = opposingTeam(playerSide);
  const draftState = new DraftState(gameData.champions);
  const draftAi = new DraftAi(aiTeam);
  const view = { screenPhase: SCREEN_PHASE.DRAFT, selectedChampionId: null, loadouts: null };
  let aiTimer = null;

  const board = createDraftBoard({ playerSide });
  const picker = createChampionPicker({ champions: gameData.champions, onSelect: selectChampion, onLockIn: lockInByDoubleClick });
  const loadoutPanel = createLoadoutPanel({ version: gameData.version, onLoadoutChange: changePlayerLoadout });
  const centerArea = createElement('div', { className: 'draft-center' }, picker.element);
  const footer = createFooter();

  root.append(createScreenElement());
  render();
  scheduleAiTurnIfNeeded();
  return () => clearTimeout(aiTimer);

  function createScreenElement() {
    return createElement('section', { className: 'draft-screen', dataset: { playerSide } },
      board.header,
      createElement('div', { className: 'draft-body' }, board.pickColumns[TEAM.BLUE], centerArea, board.pickColumns[TEAM.RED]),
      createElement('footer', { className: 'draft-footer' }, board.banRows[TEAM.BLUE], footer.element, board.banRows[TEAM.RED]),
    );
  }

  function isPlayersTurn() {
    return view.screenPhase === SCREEN_PHASE.DRAFT && draftState.currentStep?.team === playerSide;
  }

  function selectChampion(championId) {
    if (isPlayersTurn() && draftState.isChampionAvailable(championId)) {
      view.selectedChampionId = championId;
      render();
    }
  }

  // The first click of a double-click has already selected the champion.
  function lockInByDoubleClick(championId) {
    if (view.selectedChampionId === championId) {
      lockInPlayerSelection();
    }
  }

  function onPrimaryButtonClick() {
    if (view.screenPhase === SCREEN_PHASE.SWAP) {
      router.show(mountGameScreen, { gameData, playerSide, loadouts: view.loadouts });
    } else {
      lockInPlayerSelection();
    }
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

  // The player's roles start as a best guess and can be swapped; the AI's roles are the ones it drafted for.
  function enterSwapPhase() {
    view.screenPhase = SCREEN_PHASE.SWAP;
    view.loadouts = {
      [playerSide]: createLoadoutWithAutomaticRoles(draftState.picksFor(playerSide)),
      [aiTeam]: createLoadoutFromRoleMap(draftState.picksFor(aiTeam), draftAi.roleByChampionId),
    };
    centerArea.replaceChildren(loadoutPanel.element);
  }

  function changePlayerLoadout(changedLoadout) {
    view.loadouts[playerSide] = changedLoadout;
    render();
  }

  function render() {
    const isSwapPhase = view.screenPhase === SCREEN_PHASE.SWAP;
    const selectedChampion = gameData.champions.find(champion => champion.id === view.selectedChampionId) ?? null;
    board.render({ draftState, previewChampion: selectedChampion, swapLoadouts: isSwapPhase ? view.loadouts : null });
    picker.render({ isChampionAvailable: id => draftState.isChampionAvailable(id), selectedChampionId: view.selectedChampionId });
    footer.render();
    if (isSwapPhase) {
      loadoutPanel.render(view.loadouts[playerSide]);
    }
  }

  function createFooter() {
    const primaryButton = createButton('Lock in', onPrimaryButtonClick, 'button button--primary button--lock');
    primaryButton.dataset.anchor = 'lock-in';
    const hint = createElement('p', { className: 'draft-hint' });
    const element = createElement('div', { className: 'draft-footer__center' }, primaryButton, hint);
    return { element, render: () => renderFooter(primaryButton, hint) };
  }

  function renderFooter(primaryButton, hint) {
    const { label, isEnabled, hintText } = footerState();
    primaryButton.textContent = label;
    primaryButton.disabled = !isEnabled;
    hint.textContent = hintText;
  }

  function footerState() {
    if (view.screenPhase === SCREEN_PHASE.SWAP) {
      return { label: 'Start game', isEnabled: true, hintText: '' };
    }
    if (!isPlayersTurn()) {
      return { label: 'Enemy is choosing…', isEnabled: false, hintText: '' };
    }
    const verb = draftState.currentStep.action === DRAFT_ACTION.BAN ? 'Ban' : 'Lock in';
    return { label: verb, isEnabled: Boolean(view.selectedChampionId), hintText: `Tip: double-click a champion to ${verb.toLowerCase()} at once` };
  }
}
