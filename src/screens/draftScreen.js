import { createButton, createElement } from '../ui/dom.js';
import { TEAM, opposingTeam } from '../config/teams.js';
import { DRAFT_ACTION } from '../config/draftOrder.js';
import { INTENT } from '../core/intents.js';
import { DraftState } from '../draft/draftState.js';
import { DraftAi } from '../draft/draftAi.js';
import { applyLoadoutIntent, createDraftLoadouts } from '../draft/teamLoadout.js';
import { NO_TUTORIAL } from '../tutorial/noTutorial.js';
import { createLoadoutPanel } from './draft/loadoutPanel.js';
import { createChampionPicker } from './draft/championPicker.js';
import { createDraftBoard } from './draft/draftBoard.js';
import { mountGameScreen } from './gameScreen.js';

const AI_THINKING_MS = 900;
// How often a waiting AI turn asks the tutorial again whether it may go.
const AI_RETRY_MS = 250;
const SCREEN_PHASE = Object.freeze({ DRAFT: 'draft', SWAP: 'swap' });

// The draft's flow: whose turn it is, the AI's turns, locking in, and the swap phase after it.
// The board, the picker and the loadout panel draw themselves from the state passed to them.
// Every player action is an intent the tutorial may allow or block (a normal draft allows all).
export function mountDraftScreen(root, { router, gameData, playerSide, tutorial = NO_TUTORIAL }) {
  const aiTeam = opposingTeam(playerSide);
  const draftState = new DraftState(gameData.champions);
  const draftAi = tutorial.createDraftAi?.(aiTeam) ?? new DraftAi(aiTeam);
  const view = { screenPhase: SCREEN_PHASE.DRAFT, selectedChampionId: null, loadouts: null };
  let aiTimer = null;

  const board = createDraftBoard({ playerSide });
  const picker = createChampionPicker({
    champions: gameData.champions,
    onSelect: selectChampion,
    onLockIn: lockInByDoubleClick,
    canChangeFilters: () => tutorial.allows({ type: INTENT.DRAFT_FILTER }),
  });
  const loadoutPanel = createLoadoutPanel({ version: gameData.version, onIntent: changePlayerLoadout });
  const centerArea = createElement('div', { className: 'draft-center' }, picker.element);
  const footer = createFooter();

  root.append(createScreenElement());
  render();
  const detachTutorial = tutorial.attach('draft', { context: () => ({ draftState, loadouts: view.loadouts }) });
  scheduleAiTurnIfNeeded();
  return () => {
    clearTimeout(aiTimer);
    detachTutorial();
  };

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
    if (!isPlayersTurn() || !draftState.isChampionAvailable(championId)) {
      return;
    }
    if (tutorial.allows({ type: INTENT.DRAFT_SELECT, championId })) {
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
      startGame();
    } else {
      lockInPlayerSelection();
    }
  }

  function startGame() {
    const intent = { type: INTENT.START_GAME };
    if (tutorial.allows(intent)) {
      tutorial.notify(intent);
      router.show(mountGameScreen, { gameData, playerSide, loadouts: view.loadouts, tutorial });
    }
  }

  function lockInPlayerSelection() {
    const intent = { type: INTENT.DRAFT_LOCK, championId: view.selectedChampionId };
    if (!isPlayersTurn() || !view.selectedChampionId || !tutorial.allows(intent)) {
      return;
    }
    draftState.lockIn(view.selectedChampionId);
    view.selectedChampionId = null;
    afterLockIn();
    tutorial.notify(intent);
  }

  // The AI thinks for a moment before each turn. In the tutorial it also waits until the
  // current step lets the opponent move, so it never acts in the middle of an explanation.
  function scheduleAiTurnIfNeeded() {
    if (draftState.isComplete || draftState.currentStep.team !== aiTeam) {
      return;
    }
    aiTimer = setTimeout(takeAiTurnWhenAllowed, AI_THINKING_MS);
  }

  function takeAiTurnWhenAllowed() {
    if (!tutorial.canAct({ type: INTENT.DRAFT_AI_TURN })) {
      aiTimer = setTimeout(takeAiTurnWhenAllowed, AI_RETRY_MS);
      return;
    }
    draftState.lockIn(draftAi.chooseChampion(draftState).id);
    afterLockIn();
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
    view.loadouts = createDraftLoadouts(draftState, { playerSide, aiTeam, aiRoleByChampionId: draftAi.roleByChampionId });
    centerArea.replaceChildren(loadoutPanel.element);
  }

  // A blocked change still renders, which puts a changed <select> back to its old value.
  function changePlayerLoadout(intent) {
    if (tutorial.allows(intent)) {
      view.loadouts[playerSide] = applyLoadoutIntent(view.loadouts[playerSide], intent);
      tutorial.notify(intent);
    }
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
