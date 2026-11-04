import { createElement } from '../../ui/dom.js';
import { formatGameTime } from '../../ui/formatGameTime.js';

const VISIBLE_EVENT_GAME_SECONDS = 45;
const MAX_VISIBLE_EVENTS = 5;

export function createEventFeed(playerSide) {
  const element = createElement('div', { className: 'event-feed', attributes: { 'aria-live': 'polite' } });
  let shownSignature = '';

  function update(gameState) {
    const visibleEvents = gameState.events
      .filter(event => gameState.gameSeconds - event.gameSeconds <= VISIBLE_EVENT_GAME_SECONDS)
      .slice(-MAX_VISIBLE_EVENTS);
    const signature = visibleEvents.map(event => `${event.gameSeconds}:${event.text}`).join('|');
    if (signature === shownSignature) {
      return;
    }
    shownSignature = signature;
    element.replaceChildren(...visibleEvents.map(event => createElement('div', {
      className: `event-feed__item event-feed__item--${event.kind} ${event.team === playerSide ? 'is-ours' : 'is-theirs'}`,
    },
    createElement('span', { className: 'event-feed__time', text: formatGameTime(event.gameSeconds) }),
    createElement('span', { text: event.text }),
    )));
  }

  return { element, update };
}
