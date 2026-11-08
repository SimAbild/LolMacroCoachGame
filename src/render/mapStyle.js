import { TEAM, opposingTeam } from '../config/teams.js';

// Colours the Pixi map draws with, as 0xRRGGBB numbers. The legend reads the same values,
// so it always matches the map. Team and element colours mirror the tokens in styles/main.css.
export const MAP_COLORS = Object.freeze({
  background: 0x0b1116,
  jungle: 0x18241f,
  jungleEdge: 0x0f1814,
  lane: 0x3b4a42,
  river: 0x1c4a5e,
  pit: 0x24596e,
  camp: 0x6b7a72,
  campAlive: 0xc9a227,
  campOutline: 0x0b1116,
  ward: 0xf2c94c,
  ruins: 0x9aa5ad,
  iconBacking: 0x0b1116,
  plate: 0xf2e6c4,
  fight: 0xf2a51d,
  elder: 0xe8e3d0,
  voidCreature: 0x9b5de5,
  recallRing: 0x8fd3ff,
  coinText: 0xffffff,
  label: 0xe7edf3,
  labelShadow: 0x05080b,
  [TEAM.BLUE]: 0x3a9be8,
  [TEAM.RED]: 0xe0505b,
});

// Map labels use the display font of the UI; Arial Narrow if it has not loaded.
export const LABEL_FONT_FAMILY = "'Barlow Condensed', 'Arial Narrow', sans-serif";

export const ELEMENT_COLORS = Object.freeze({
  Infernal: 0xe8603c,
  Mountain: 0xb08d57,
  Ocean: 0x3fb6c9,
  Cloud: 0xc7d3e0,
  Hextech: 0x4fd1c5,
  Chemtech: 0x8fcf3a,
});

export const LEGEND_SHAPE = Object.freeze({
  COIN: 'coin',
  DOT: 'dot',
  RING: 'ring',
  MINION: 'minion',
  CANNON: 'cannon',
  SUPER_MINION: 'superMinion',
  TOWER: 'tower',
  INHIBITOR: 'inhibitor',
  NEXUS: 'nexus',
  RUINS: 'ruins',
  WARD: 'ward',
  CAMP: 'camp',
  FOG: 'fog',
});

// What the legend lists, in the colours of the player's side.
export function legendItemsFor(playerSide) {
  const ally = MAP_COLORS[playerSide];
  const enemy = MAP_COLORS[opposingTeam(playerSide)];
  return [
    { label: 'Your champion', shape: LEGEND_SHAPE.COIN, color: ally },
    { label: 'Enemy champion (in vision)', shape: LEGEND_SHAPE.COIN, color: enemy },
    { label: 'Melee and caster minions', shape: LEGEND_SHAPE.MINION, color: ally },
    { label: 'Cannon minion', shape: LEGEND_SHAPE.CANNON, color: ally },
    { label: 'Super minion (enemy inhibitor down)', shape: LEGEND_SHAPE.SUPER_MINION, color: ally },
    { label: 'Tower (ring = health, dots = plates)', shape: LEGEND_SHAPE.TOWER, color: ally },
    { label: 'Inhibitor (ring = health)', shape: LEGEND_SHAPE.INHIBITOR, color: ally },
    { label: 'Nexus (ring = health)', shape: LEGEND_SHAPE.NEXUS, color: ally },
    { label: 'Destroyed (a ring fills until an inhibitor respawns)', shape: LEGEND_SHAPE.RUINS, color: MAP_COLORS.ruins },
    { label: 'Your ward', shape: LEGEND_SHAPE.WARD, color: MAP_COLORS.ward },
    { label: 'Jungle camp (up / respawning)', shape: LEGEND_SHAPE.CAMP, color: MAP_COLORS.campAlive },
    { label: 'Drake (colour = element)', shape: LEGEND_SHAPE.DOT, color: ELEMENT_COLORS.Infernal },
    { label: 'Baron, Herald, Void Grubs', shape: LEGEND_SHAPE.DOT, color: MAP_COLORS.voidCreature },
    { label: 'Fight', shape: LEGEND_SHAPE.RING, color: MAP_COLORS.fight },
    { label: 'Recalling', shape: LEGEND_SHAPE.RING, color: MAP_COLORS.recallRing },
    { label: 'Fog: no vision there', shape: LEGEND_SHAPE.FOG },
  ];
}

export function toCssColor(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}
