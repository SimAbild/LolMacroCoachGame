import { createElement } from '../../ui/dom.js';
import { TEAM } from '../../config/teams.js';
import { displayedStateFor } from '../../game/simulation/scoutingSystem.js';
import { createChampionPanel } from './championPanel.js';

// The two columns of champion cards, and the dashed link between the two cards a call involves.
export function createTeamRoster({ gameState, gameData, playerSide, overlay, onIntent }) {
  const panelsByChampionState = new Map();
  const cardsByTeamAndRole = { [TEAM.BLUE]: new Map(), [TEAM.RED]: new Map() };
  const columns = { [TEAM.BLUE]: createColumn(TEAM.BLUE), [TEAM.RED]: createColumn(TEAM.RED) };

  function createColumn(team) {
    const column = createElement('aside', { className: `team-column team-column--${team}` });
    for (const championState of gameState.teams[team].champions) {
      const panel = createChampionPanel(championState, {
        version: gameData.version,
        itemCatalog: gameData.items,
        isOwnTeam: team === playerSide,
        onIntent,
        onActionHover: showLink,
      });
      panelsByChampionState.set(championState, panel);
      cardsByTeamAndRole[team].set(championState.role, panel.element);
      column.append(panel.element);
    }
    return column;
  }

  // Enemy cards show what the player last saw, not the live state (fog of war).
  function update() {
    for (const [championState, panel] of panelsByChampionState) {
      panel.update(displayedStateFor(championState, playerSide));
    }
  }

  function clearLinks() {
    for (const teamCards of Object.values(cardsByTeamAndRole)) {
      for (const card of teamCards.values()) {
        card.classList.remove('is-coordinating');
      }
    }
    overlay.clear();
  }

  function showLink(championState, targetRole) {
    clearLinks();
    if (!targetRole) {
      return;
    }
    const teamCards = cardsByTeamAndRole[championState.team];
    const targetCard = teamCards.get(targetRole);
    targetCard.classList.add('is-coordinating');
    overlay.showLink(teamCards.get(championState.role), targetCard, championState.team === TEAM.BLUE);
  }

  return { columns, update, clearLinks };
}
