import { DRAFT_ACTION, DRAFT_STEPS } from '../config/draftOrder.js';
import { TEAM } from '../config/teams.js';

export class DraftState {
  #championsById;
  #stepIndex = 0;
  #bans = { [TEAM.BLUE]: [], [TEAM.RED]: [] };
  #picks = { [TEAM.BLUE]: [], [TEAM.RED]: [] };

  constructor(champions) {
    this.#championsById = new Map(champions.map(champion => [champion.id, champion]));
  }

  get stepIndex() {
    return this.#stepIndex;
  }

  get currentStep() {
    return DRAFT_STEPS[this.#stepIndex] ?? null;
  }

  get isComplete() {
    return this.#stepIndex >= DRAFT_STEPS.length;
  }

  bansFor(team) {
    return [...this.#bans[team]];
  }

  picksFor(team) {
    return [...this.#picks[team]];
  }

  isChampionAvailable(championId) {
    return this.#championsById.has(championId) && !this.#usedChampionIds().has(championId);
  }

  availableChampions() {
    const usedChampionIds = this.#usedChampionIds();
    return [...this.#championsById.values()].filter(champion => !usedChampionIds.has(champion.id));
  }

  lockIn(championId) {
    if (this.isComplete) {
      throw new Error('The draft is already complete.');
    }
    if (!this.isChampionAvailable(championId)) {
      throw new Error(`Champion ${championId} is not available.`);
    }
    const { team, action } = this.currentStep;
    const champion = this.#championsById.get(championId);
    const targetList = action === DRAFT_ACTION.BAN ? this.#bans[team] : this.#picks[team];
    targetList.push(champion);
    this.#stepIndex += 1;
    return champion;
  }

  #usedChampionIds() {
    const allUsedChampions = [
      ...this.#bans[TEAM.BLUE], ...this.#bans[TEAM.RED],
      ...this.#picks[TEAM.BLUE], ...this.#picks[TEAM.RED],
    ];
    return new Set(allUsedChampions.map(champion => champion.id));
  }
}
