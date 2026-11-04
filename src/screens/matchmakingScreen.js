import { createButton, createElement } from '../ui/dom.js';
import { TEAM_LABELS, randomTeam } from '../config/teams.js';
import { mountDraftScreen } from './draftScreen.js';

const SEARCH_DURATION_MS = 1800;

export function mountMatchmakingScreen(root, { router, gameData }) {
  const card = createElement('div', { className: 'matchmaking-card' },
    createElement('div', { className: 'spinner', attributes: { 'aria-hidden': 'true' } }),
    createElement('h2', { text: 'Searching for opponent…' }),
    createElement('p', { className: 'muted', text: 'Opponent: AI coach' }),
  );
  root.append(createElement('section', { className: 'matchmaking-screen' }, card));

  const searchTimer = setTimeout(() => {
    const playerSide = randomTeam();
    card.replaceChildren(
      createElement('p', { className: 'matchmaking-card__eyebrow', text: 'Match found' }),
      createElement('h2', { className: `side-label side-label--${playerSide}`, text: `You are ${TEAM_LABELS[playerSide]} side` }),
      createElement('p', { className: 'muted', text: 'Tournament draft vs AI coach' }),
      createButton('Accept', () => router.show(mountDraftScreen, { gameData, playerSide }), 'button button--primary button--large'),
    );
  }, SEARCH_DURATION_MS);

  return () => clearTimeout(searchTimer);
}
