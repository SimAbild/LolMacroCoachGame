export const OBJECTIVE_KEY = Object.freeze({
  DRAGON: 'dragon',
  ELDER: 'elder',
  GRUBS: 'grubs',
  HERALD: 'herald',
  BARON: 'baron',
});

export const OBJECTIVE_LABELS = Object.freeze({
  dragon: 'Dragon',
  elder: 'Elder Dragon',
  grubs: 'Void Grubs',
  herald: 'Rift Herald',
  baron: 'Baron Nashor',
});

export const OBJECTIVE_CONTEST_PRIORITY = Object.freeze(['baron', 'elder', 'dragon', 'herald', 'grubs']);

export const DRAGON_FIRST_SPAWN_SECONDS = 300;
export const DRAGON_RESPAWN_SECONDS = 300;
export const DRAGON_ELEMENTS = Object.freeze(['Infernal', 'Mountain', 'Ocean', 'Cloud', 'Hextech', 'Chemtech']);
export const DRAKES_BEFORE_RIFT_ELEMENT = 2;
export const DRAKES_FOR_SOUL = 4;
export const ELDER_SPAWN_DELAY_AFTER_SOUL_SECONDS = 360;
export const ELDER_RESPAWN_SECONDS = 360;
export const ELDER_BUFF_SECONDS = 150;
export const VOID_GRUBS_SPAWN_SECONDS = 480;
export const VOID_GRUBS_DESPAWN_SECONDS = 885;
export const VOID_GRUBS_COUNT = 3;
export const HERALD_SPAWN_SECONDS = 900;
export const HERALD_DESPAWN_SECONDS = 1185;
export const BARON_SPAWN_SECONDS = 1200;
export const BARON_RESPAWN_SECONDS = 360;
export const BARON_BUFF_SECONDS = 180;
export const BARON_GOLD_PER_CHAMPION = 300;
export const BARON_VARIANTS = Object.freeze(['Hunting', 'Territorial', 'All-Seeing']);

export const OBJECTIVE_EFFORT = Object.freeze({
  dragon: 30,
  elder: 60,
  grubs: 24,
  herald: 40,
  baron: 80,
});

export const OBJECTIVE_RANGE = 90;
export const CONTEST_SPAWN_LOOKAHEAD_SECONDS = 30;

export const DRAKE_POWER_PER_STACK = 0.03;
export const SOUL_POWER = 0.08;
export const ELDER_POWER = 0.25;
export const BARON_POWER = 0.15;
export const BARON_SIEGE_MULTIPLIER = 2;
export const BARON_PUSH_MULTIPLIER = 1.6;
export const VOID_GRUB_SIEGE_BONUS_PER_STACK = 0.15;
export const HERALD_STRUCTURE_DAMAGE = 0.6;
