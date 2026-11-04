export const SUMMONER_SPELLS = Object.freeze({
  flash: { label: 'Flash', iconId: 'SummonerFlash' },
  ignite: { label: 'Ignite', iconId: 'SummonerDot' },
  teleport: { label: 'Teleport', iconId: 'SummonerTeleport' },
  smite: { label: 'Smite', iconId: 'SummonerSmite' },
  heal: { label: 'Heal', iconId: 'SummonerHeal' },
  exhaust: { label: 'Exhaust', iconId: 'SummonerExhaust' },
  barrier: { label: 'Barrier', iconId: 'SummonerBarrier' },
  cleanse: { label: 'Cleanse', iconId: 'SummonerBoost' },
  ghost: { label: 'Ghost', iconId: 'SummonerHaste' },
});

export const SUMMONER_SPELL_IDS = Object.freeze(Object.keys(SUMMONER_SPELLS));

export const DEFAULT_SUMMONERS_BY_ROLE = Object.freeze({
  top: ['flash', 'teleport'],
  jungle: ['flash', 'smite'],
  mid: ['flash', 'ignite'],
  bot: ['flash', 'heal'],
  support: ['flash', 'ignite'],
});
