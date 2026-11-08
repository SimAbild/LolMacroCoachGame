export const DEFAULT_AI_WEIGHTS = Object.freeze({
  minimumDecisionScore: 0.55,

  gankBase: 0.2,
  gankEnemyPushedIn: 0.45,
  gankDiveSetup: 0.25,
  gankTargetLowHealth: 0.422,
  gankTargetNoFlash: 0.267,
  gankLevelLead: 0.075,
  gankEnemyJunglerFarAway: 0.2,
  gankEnemyJunglerNearby: 0.6,
  gankObjectiveSoon: 0.204,
  gankTravelPerThousand: 0.247,
  gankRating: 0.03,

  roamBase: 0.049,
  roamOwnWavePushed: 0.25,

  wardObjectiveBase: 0.519,
  wardObjectiveSoon: 0.347,
  wardDeepWhenJunglerMissing: 0.3,

  setupObjectiveBase: 0.551,

  contestBase: 0.35,
  contestValueDragon: 0.307,
  contestValueGrubs: 0.178,
  contestValueHerald: 0.2,
  contestValueBaron: 0.578,
  contestValueElder: 0.621,
  contestPerAliveAdvantage: 0.18,
  contestPowerAdvantage: 0.342,
  contestLanePriority: 0.06,
  contestEnemyAtPit: 0.099,

  groupBase: 0.116,
  groupGoldLeadPerThousand: 0.06,
  groupBaronBuff: 0.493,
  groupAliveAdvantage: 0.15,

  engageBase: 0.153,
  engagePowerAdvantage: 0.8,
  engageAliveAdvantage: 0.21,

  diveBase: 0.181,
  diveTargetLowHealth: 0.402,
  diveOwnHealth: 0.25,

  shoveForObjective: 0.572,

  freezeBase: 0.26,
  freezeWhenAhead: 0.731,
  slowPushBase: 0.293,
  slowPushCannonNext: 0.247,
  slowPushWhenAhead: 0.3,
  tradeBase: 0.3,
  tradeWhenAhead: 0.8,
  safeBase: 0.241,
  safeWhenBehind: 0.583,
  safeWhenHurt: 0.5,
  stopSafeBase: 0.626,
  resetAfterCrash: 0.895,
  // Set by hand: self-play cannot weigh Cover, because the tuning runs start where it is never chosen.
  coverBase: 0.28,
  coverPush: 0.3,

  backOffPowerRatio: 0.75,
});
