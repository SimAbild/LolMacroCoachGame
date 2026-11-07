// Plays its side of the draft from a script instead of choosing. Same interface as DraftAi,
// so the draft screen does not know the difference. Used by the guided tutorial.
export class ScriptedDraftAi {
  #draftScript;
  #roleByChampionId = new Map();

  // draftScript: one resolved entry per draft step ({ champion, role? }), see tutorial/scenario.js.
  constructor(draftScript) {
    this.#draftScript = draftScript;
  }

  get roleByChampionId() {
    return new Map(this.#roleByChampionId);
  }

  chooseChampion(draftState) {
    const entry = this.#draftScript[draftState.stepIndex];
    if (entry.role) {
      this.#roleByChampionId.set(entry.champion.id, entry.role);
    }
    return entry.champion;
  }
}
