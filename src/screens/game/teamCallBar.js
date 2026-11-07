import { createButton, createElement } from '../../ui/dom.js';
import { attachTooltip } from '../../ui/tooltip.js';
import { TEAM_CALLS } from '../../config/actions.js';
import { INTENT } from '../../core/intents.js';

export function createTeamCallBar({ objectiveTimersElement, onIntent }) {
  const buttons = TEAM_CALLS.map(teamCall => {
    const button = createButton(teamCall.label, () => onIntent({ type: INTENT.TEAM_CALL, callId: teamCall.id }), 'team-call');
    button.dataset.teamCall = teamCall.id;
    attachTooltip(button, { title: teamCall.label, body: teamCall.description });
    return button;
  });
  const element = createElement('div', { className: 'team-calls', dataset: { anchor: 'team-calls' } },
    objectiveTimersElement,
    createElement('span', { className: 'team-calls__label', text: 'Team calls' }),
    ...buttons,
  );
  return { element };
}
