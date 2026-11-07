import { createElement, createImage } from '../../ui/dom.js';
import { TEAM, TEAM_LABELS } from '../../config/teams.js';
import { DRAFT_ACTION, PICKS_PER_TEAM, banLabelsFor, phaseNameForStep } from '../../config/draftOrder.js';
import { ROLE_LABELS } from '../../config/roles.js';

// Ban slots are shown in the order tournaments use: three bans, a gap, then the two later bans.
const BAN_DISPLAY_ORDER = Object.freeze({
  [TEAM.BLUE]: Object.freeze([0, 1, 2, null, 3, 4]),
  [TEAM.RED]: Object.freeze([4, 3, null, 2, 1, 0]),
});
const TEAMS = Object.freeze([TEAM.BLUE, TEAM.RED]);

// Everything around the picker: team banners, the phase label, both pick columns and both ban rows.
export function createDraftBoard({ playerSide }) {
  const phaseLabel = createElement('div', { className: 'draft-phase-label' });
  const pickSlots = byTeam(createPickSlots);
  const banSlots = byTeam(team => banLabelsFor(team).map(label => createElement('div', { className: `ban-slot ban-slot--${team}`, dataset: { label } })));
  const header = createElement('header', { className: 'draft-header' },
    createTeamBanner(TEAM.BLUE, playerSide), phaseLabel, createTeamBanner(TEAM.RED, playerSide));
  const pickColumns = byTeam(team => createElement('div', { className: `pick-column pick-column--${team}` }, ...pickSlots[team]));
  const banRows = byTeam(team => createBanRow(team, banSlots[team]));

  // boardView is { draftState, previewChampion, swapLoadouts }: the champion the player has
  // selected (shown faded in the active slot), and in the swap phase the loadouts by team.
  function render(boardView) {
    renderPhaseLabel(phaseLabel, { ...boardView, playerSide });
    for (const team of TEAMS) {
      renderBanSlots(banSlots[team], { ...boardView, team, playerSide });
      renderPickSlots(pickSlots[team], { ...boardView, team, playerSide });
    }
  }

  return { header, pickColumns, banRows, render };
}

function byTeam(valueForTeam) {
  return { [TEAM.BLUE]: valueForTeam(TEAM.BLUE), [TEAM.RED]: valueForTeam(TEAM.RED) };
}

function createTeamBanner(team, playerSide) {
  const youSuffix = team === playerSide ? ' (you)' : '';
  return createElement('div', { className: `team-banner team-banner--${team}`, text: `${TEAM_LABELS[team]}${youSuffix}` });
}

function createPickSlots(team) {
  return Array.from({ length: PICKS_PER_TEAM }, (_, slotIndex) => createElement('div', {
    className: `pick-slot pick-slot--${team}`,
    dataset: { label: `${team === TEAM.BLUE ? 'B' : 'R'}${slotIndex + 1}` },
  }));
}

function createBanRow(team, slots) {
  const row = createElement('div', { className: `ban-row ban-row--${team}`, dataset: { team } });
  for (const slotIndex of BAN_DISPLAY_ORDER[team]) {
    row.append(slotIndex === null ? createElement('div', { className: 'ban-row__gap' }) : slots[slotIndex]);
  }
  return row;
}

function renderPhaseLabel(phaseLabel, { draftState, swapLoadouts, playerSide }) {
  if (swapLoadouts) {
    phaseLabel.textContent = 'Swap phase · set roles, builds and summoners';
    return;
  }
  const { team, action } = draftState.currentStep;
  const verb = action === DRAFT_ACTION.BAN ? 'banning' : 'picking';
  const youSuffix = team === playerSide ? ' (you)' : '';
  phaseLabel.textContent = `${phaseNameForStep(draftState.stepIndex)} · ${TEAM_LABELS[team]}${youSuffix} ${verb}`;
  phaseLabel.dataset.team = team;
}

function renderBanSlots(slots, { draftState, team, ...slotContext }) {
  const bans = draftState.bansFor(team);
  slots.forEach((slot, slotIndex) => {
    const isActive = isActiveSlot(draftState, { team, action: DRAFT_ACTION.BAN, slotIndex });
    const preview = previewFor({ isActive, team, ...slotContext });
    fillSlot(slot, bans[slotIndex] ?? preview, { isPreview: !bans[slotIndex] && Boolean(preview) });
    slot.classList.toggle('is-active', isActive);
  });
}

function renderPickSlots(slots, { draftState, team, swapLoadouts, ...slotContext }) {
  slots.forEach((slot, slotIndex) => {
    if (swapLoadouts) {
      const entry = swapLoadouts[team][slotIndex];
      fillSlot(slot, entry.champion, { roleLabel: ROLE_LABELS[entry.role] });
      slot.classList.remove('is-active');
      return;
    }
    const pickedChampion = draftState.picksFor(team)[slotIndex];
    const isActive = isActiveSlot(draftState, { team, action: DRAFT_ACTION.PICK, slotIndex });
    const preview = previewFor({ isActive, team, ...slotContext });
    fillSlot(slot, pickedChampion ?? preview, { isPreview: !pickedChampion && Boolean(preview) });
    slot.classList.toggle('is-active', isActive);
  });
}

// Only the player's own active slot previews the champion they have selected.
function previewFor({ isActive, team, playerSide, previewChampion }) {
  return isActive && team === playerSide ? previewChampion : null;
}

function isActiveSlot(draftState, { team, action, slotIndex }) {
  const step = draftState.currentStep;
  return Boolean(step) && step.team === team && step.action === action && step.slotIndex === slotIndex;
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
