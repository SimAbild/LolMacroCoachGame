import { createElement } from '../../ui/dom.js';
import { formatGameTime } from '../../ui/formatGameTime.js';
import { OBJECTIVE_KEY, OBJECTIVE_LABELS } from '../../config/objectiveRules.js';
import { upcomingObjectiveTimers } from '../../game/objectives.js';

const MAX_TIMERS_SHOWN = 3;

export function createObjectiveTimers() {
  const element = createElement('div', { className: 'objective-timers', attributes: { 'aria-label': 'Objective timers' } });
  let shownSignature = '';

  function update(gameState) {
    const timers = upcomingObjectiveTimers(gameState).slice(0, MAX_TIMERS_SHOWN);
    const signature = timers.map(({ objective, secondsUntilSpawn }) => `${objective.key}:${Math.ceil(secondsUntilSpawn)}:${objective.element ?? ''}`).join('|');
    if (signature === shownSignature) {
      return;
    }
    shownSignature = signature;
    element.replaceChildren(...timers.map(({ objective, secondsUntilSpawn }) => createElement('span', {
      className: `objective-timer${objective.isAlive ? ' is-up' : ''}`,
      dataset: { objective: objective.key, element: objective.element ?? '' },
    },
    createElement('span', { className: 'objective-timer__name', text: timerLabel(objective) }),
    createElement('span', { className: 'objective-timer__time', text: objective.isAlive ? 'UP' : formatGameTime(secondsUntilSpawn) }),
    )));
  }

  return { element, update };
}

function timerLabel(objective) {
  if (objective.key === OBJECTIVE_KEY.DRAGON) {
    return `${objective.element} Drake`;
  }
  if (objective.key === OBJECTIVE_KEY.BARON) {
    return `Baron (${objective.variant})`;
  }
  return OBJECTIVE_LABELS[objective.key];
}
