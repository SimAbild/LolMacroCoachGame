import { createElement } from '../../ui/dom.js';
import { attachTooltip } from '../../ui/tooltip.js';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';
import { CALL_HELP_ACTION_ID, ROLE_ACTIONS, describeHelpRequest } from '../../config/actions.js';
import { INTENT } from '../../core/intents.js';

// The call buttons on one of the player's champion cards, plus the "Call help" row that opens
// below them to choose the helper. Returns the two rows to append to the card.
export function createActionControls(championState, { onIntent, onActionHover }) {
  const { role } = championState;
  const helpRow = createHelpRow(championState, { onIntent, onActionHover, onChosen: () => setHelpRowOpen(false) });
  const actionChips = createElement('div', { className: 'action-chips' });
  let callHelpChip = null;

  for (const action of ROLE_ACTIONS[role]) {
    const isCallHelp = action.id === CALL_HELP_ACTION_ID;
    const chip = createActionChip(championState, { label: action.label, linkedRole: action.targetRole, onActionHover }, () => {
      if (isCallHelp) {
        setHelpRowOpen(helpRow.hidden);
      } else {
        onIntent({ type: INTENT.CHAMPION_ACTION, role, actionId: action.id });
      }
    });
    chip.dataset.actionId = action.id;
    attachTooltip(chip, { title: action.label, body: action.description });
    if (isCallHelp) {
      callHelpChip = chip;
    }
    actionChips.append(chip);
  }

  function setHelpRowOpen(isOpen) {
    helpRow.hidden = !isOpen;
    callHelpChip?.setAttribute('aria-expanded', String(isOpen));
  }

  setHelpRowOpen(false);
  return [actionChips, helpRow];
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
