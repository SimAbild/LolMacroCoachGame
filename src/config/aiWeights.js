export const DEFAULT_AI_WEIGHTS = Object.freeze({
  minimumDecisionScore: 0.55,

  gankBase: 0.2,
  gankEnemyPushedIn: 0.45,
  gankDiveSetup: 0.25,
  gankTargetLowHealth: 0.35,
  gankTargetNoFlash: 0.2,
  gankLevelLead: 0.08,
  gankEnemyJunglerFarAway: 0.2,
  gankEnemyJunglerNearby: 0.6,
  gankObjectiveSoon: 0.3,
  gankTravelPerThousand: 0.25,
  gankRating: 0.03,

  roamBase: 0.05,
  roamOwnWavePushed: 0.25,

  wardObjectiveBase: 0.45,
  wardObjectiveSoon: 0.35,
  wardDeepWhenJunglerMissing: 0.3,

  setupObjectiveBase: 0.5,

  contestBase: 0.35,
  contestValueDragon: 0.25,
  contestValueGrubs: 0.15,
  contestValueHerald: 0.2,
  contestValueBaron: 0.45,
  contestValueElder: 0.6,
  contestPerAliveAdvantage: 0.18,
  contestPowerAdvantage: 0.4,
  contestLanePriority: 0.06,
  contestEnemyAtPit: 0.12,

  groupBase: 0.1,
  groupGoldLeadPerThousand: 0.06,
  groupBaronBuff: 0.45,
  groupAliveAdvantage: 0.15,

  engageBase: 0.15,
  engagePowerAdvantage: 0.8,
  engageAliveAdvantage: 0.2,

  diveBase: 0.15,
  diveTargetLowHealth: 0.5,
  diveOwnHealth: 0.25,

  shoveForObjective: 0.6,

  backOffPowerRatio: 0.75,
});
