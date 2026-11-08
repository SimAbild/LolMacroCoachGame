import { createElement } from '../../ui/dom.js';
import { attachTooltip } from '../../ui/tooltip.js';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';
import { CALL_HELP_ACTION_ID, LANE_ORDER_SLOT, ROLE_ACTIONS, describeHelpRequest } from '../../config/actions.js';
import { INTENT } from '../../core/intents.js';

const CALL_ROWS = Object.freeze([
  { label: 'Wave', includes: action => action.orderSlot === LANE_ORDER_SLOT.WAVE },
  { label: 'Stance', includes: action => action.orderSlot === LANE_ORDER_SLOT.POSTURE },
  { label: null, includes: action => !action.orderSlot },
]);

// The call buttons on one of the player's champion cards, one row per group, plus the "Call help"
// row that opens below them to choose the helper. Wave plans and stances stay lit while they
// last, so the card always shows what the champion has been told to do.
export function createActionControls(championState, { onIntent, onActionHover }) {
  const { role } = championState;
  const helpRow = createHelpRow(championState, { onIntent, onActionHover, onChosen: () => setHelpRowOpen(false) });
  const orderChips = [];
  let callHelpChip = null;

  function createCallChip(action) {
    const isCallHelp = action.id === CALL_HELP_ACTION_ID;
    const chip = createActionChip(championState, { label: action.label, linkedRole: action.targetRole, onActionHover }, () => {
      if (isCallHelp) {
        setHelpRowOpen(helpRow.hidden);
      } else {
        onIntent({ type: INTENT.CHAMPION_ACTION, role, actionId: action.id });
      }
    });
    chip.dataset.actionId = action.id;
    attachTooltip(chip, tooltipFor(action));
    callHelpChip = isCallHelp ? chip : callHelpChip;
    if (action.orderSlot) {
      orderChips.push({ chip, action });
    }
    return chip;
  }

  const callRows = CALL_ROWS
    .map(({ label, includes }) => ({ label, actions: ROLE_ACTIONS[role].filter(includes) }))
    .filter(({ actions }) => actions.length > 0)
    .map(({ label, actions }) => createElement('div', { className: 'action-chips' },
      label ? createElement('span', { className: 'action-chips__label', text: label }) : null,
      ...actions.map(createCallChip),
    ));

  function setHelpRowOpen(isOpen) {
    helpRow.hidden = !isOpen;
    callHelpChip?.setAttribute('aria-expanded', String(isOpen));
  }

  function update(displayedState) {
    for (const { chip, action } of orderChips) {
      const isActive = displayedState.laneOrders[action.orderSlot] === action.kind;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', String(isActive));
    }
  }

  setHelpRowOpen(false);
  return { rows: [...callRows, helpRow], update };
}

function tooltipFor(action) {
  return {
    title: action.label,
    body: action.description,
    details: [
      { label: 'Gain', text: action.pros },
      { label: 'Cost', text: action.cons },
      { label: 'Best when', text: action.bestWhen },
    ],
  };
}

function createHelpRow(championState, { onIntent, onActionHover, onChosen }) {
  const { role } = championState;
  const helpRow = createElement('div', { className: 'help-targets' });
  for (const helperRole of ROLES.filter(otherRole => otherRole !== role)) {
    const chip = createActionChip(championState, { label: `with ${ROLE_LABELS[helperRole]}`, linkedRole: helperRole, onActionHover }, () => {
      onChosen();
      onIntent({ type: INTENT.CHAMPION_ACTION, role, actionId: CALL_HELP_ACTION_ID, helperRole });
    });
    chip.dataset.helperRole = helperRole;
    attachTooltip(chip, { title: `Call help: ${ROLE_LABELS[helperRole]}`, body: describeHelpRequest(role, helperRole) });
    helpRow.append(chip);
  }
  return helpRow;
}

// Chips that involve another role also draw the coordination link to that role's card on hover and focus.
function createActionChip(championState, { label, linkedRole, onActionHover }, onClick) {
  const chip = createElement('button', { className: 'action-chip', text: label, attributes: { type: 'button' } });
  chip.addEventListener('click', onClick);
  if (linkedRole) {
    const showLink = () => onActionHover(championState, linkedRole);
    const hideLink = () => onActionHover(championState, null);
    chip.addEventListener('mouseenter', showLink);
    chip.addEventListener('mouseleave', hideLink);
    chip.addEventListener('focus', showLink);
    chip.addEventListener('blur', hideLink);
  }
  return chip;
}
