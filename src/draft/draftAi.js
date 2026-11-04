import { DRAFT_ACTION } from '../config/draftOrder.js';
import { ROLES } from '../config/roles.js';

export class DraftAi {
  #team;
  #roleByChampionId = new Map();

  constructor(team) {
    this.#team = team;
  }

  get roleByChampionId() {
    return new Map(this.#roleByChampionId);
  }

  chooseChampion(draftState) {
    const { action } = draftState.currentStep;
    return action === DRAFT_ACTION.BAN ? this.#chooseBan(draftState) : this.#choosePick(draftState);
  }

  #chooseBan(draftState) {
    return randomItem(draftState.availableChampions());
  }

  #choosePick(draftState) {
    const availableChampions = draftState.availableChampions();
    for (const role of shuffled(this.#openRoles())) {
      const candidates = availableChampions.filter(champion => champion.roles.includes(role));
      if (candidates.length > 0) {
        const champion = randomItem(candidates);
        this.#roleByChampionId.set(champion.id, role);
        return champion;
      }
    }
    const fallbackChampion = randomItem(availableChampions);
    this.#roleByChampionId.set(fallbackChampion.id, this.#openRoles()[0]);
    return fallbackChampion;
  }

  #openRoles() {
    const takenRoles = new Set(this.#roleByChampionId.values());
    return ROLES.filter(role => !takenRoles.has(role));
  }
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
