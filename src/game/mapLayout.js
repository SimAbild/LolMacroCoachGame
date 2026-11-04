import { TEAM } from '../config/teams.js';

export const MAP_SIZE = 1000;
export const CHAMPION_VISION_RADIUS = 125;
export const TOWER_VISION_RADIUS = 110;
export const BASE_VISION_RADIUS = 240;
export const MINION_WAVE_VISION_RADIUS = 90;

export const STRUCTURE_TYPE = Object.freeze({
  TOWER: 'tower',
  INHIBITOR: 'inhibitor',
  NEXUS: 'nexus',
});

const BLUE_STRUCTURES = Object.freeze([
  { type: STRUCTURE_TYPE.TOWER, lane: 'top', tier: 'outer', x: 85, y: 280 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'top', tier: 'inner', x: 90, y: 500 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'top', tier: 'inhibitorTower', x: 95, y: 700 },
  { type: STRUCTURE_TYPE.INHIBITOR, lane: 'top', tier: 'inhibitor', x: 100, y: 775 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'mid', tier: 'outer', x: 395, y: 605 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'mid', tier: 'inner', x: 330, y: 670 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'mid', tier: 'inhibitorTower', x: 255, y: 745 },
  { type: STRUCTURE_TYPE.INHIBITOR, lane: 'mid', tier: 'inhibitor', x: 215, y: 785 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'bot', tier: 'outer', x: 720, y: 915 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'bot', tier: 'inner', x: 500, y: 910 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'bot', tier: 'inhibitorTower', x: 300, y: 905 },
  { type: STRUCTURE_TYPE.INHIBITOR, lane: 'bot', tier: 'inhibitor', x: 225, y: 900 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'base', tier: 'nexusTower', x: 140, y: 830 },
  { type: STRUCTURE_TYPE.TOWER, lane: 'base', tier: 'nexusTower', x: 170, y: 860 },
  { type: STRUCTURE_TYPE.NEXUS, lane: 'base', tier: 'nexus', x: 115, y: 885 },
]);

const BLUE_JUNGLE_CAMPS = Object.freeze([
  { x: 155, y: 450 }, { x: 250, y: 470 }, { x: 255, y: 585 },
  { x: 480, y: 635 }, { x: 530, y: 760 }, { x: 575, y: 850 },
]);

export const LANE_PATHS = Object.freeze({
  top: [[100, 860], [85, 140], [140, 85], [860, 100]],
  mid: [[170, 830], [830, 170]],
  bot: [[140, 900], [860, 915], [915, 860], [900, 140]],
});

export const RIVER_PATH = Object.freeze([[130, 130], [870, 870]]);
export const BARON_PIT = Object.freeze({ x: 315, y: 315 });
export const DRAGON_PIT = Object.freeze({ x: 685, y: 685 });
export const BASE_CENTERS = Object.freeze({ [TEAM.BLUE]: { x: 60, y: 940 }, [TEAM.RED]: { x: 940, y: 60 } });
export const FOUNTAIN_POSITIONS = Object.freeze({ [TEAM.BLUE]: { x: 45, y: 955 }, [TEAM.RED]: { x: 955, y: 45 } });

export const LANE_BY_ROLE = Object.freeze({ top: 'top', mid: 'mid', bot: 'bot', support: 'bot' });

const BLUE_WARD_SPOTS = Object.freeze({
  objectiveTop: { x: 290, y: 345 },
  objectiveBot: { x: 655, y: 715 },
  deepTop: { x: 450, y: 210 },
  deepBot: { x: 790, y: 560 },
});

export function wardSpotFor(team, spotName) {
  return mirrorForTeam(BLUE_WARD_SPOTS[spotName], team);
}

export function structuresFor(team) {
  return BLUE_STRUCTURES.map(structure => ({ ...structure, ...mirrorForTeam(structure, team) }));
}

export function jungleCampsFor(team) {
  return BLUE_JUNGLE_CAMPS.map(camp => mirrorForTeam(camp, team));
}

function mirrorForTeam(position, team) {
  return team === TEAM.BLUE ? { x: position.x, y: position.y } : { x: position.y, y: position.x };
}
