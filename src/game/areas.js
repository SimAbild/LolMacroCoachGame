import { TEAM } from '../config/teams.js';
import { MAP_SIZE } from './mapLayout.js';

const MID_LANE_BAND = 90;
const RIVER_BAND = 70;
const SIDE_LANE_BAND = 130;
const BASE_BAND = 260;

// A short, player-relative place name for alerts and the kill feed, e.g. "in their top side jungle".
// Blue's base is bottom-left and red's top-right; mid runs along the x + y = MAP_SIZE diagonal.
export function describeArea(position, perspectiveTeam) {
  return describeBase(position, perspectiveTeam) ?? describeLane(position) ?? describeRiverOrJungle(position, perspectiveTeam);
}

function describeBase(position, perspectiveTeam) {
  const baseOwner = baseOwnerAt(position);
  if (!baseOwner) {
    return null;
  }
  return baseOwner === perspectiveTeam ? 'in your base' : 'in their base';
}

function baseOwnerAt({ x, y }) {
  if (x < BASE_BAND && y > MAP_SIZE - BASE_BAND) {
    return TEAM.BLUE;
  }
  if (x > MAP_SIZE - BASE_BAND && y < BASE_BAND) {
    return TEAM.RED;
  }
  return null;
}

function describeLane({ x, y }) {
  if (x < SIDE_LANE_BAND || y < SIDE_LANE_BAND) {
    return 'top lane';
  }
  if (x > MAP_SIZE - SIDE_LANE_BAND || y > MAP_SIZE - SIDE_LANE_BAND) {
    return 'bot lane';
  }
  return Math.abs(x + y - MAP_SIZE) < MID_LANE_BAND ? 'mid lane' : null;
}

function describeRiverOrJungle({ x, y }, perspectiveTeam) {
  const sideOfMid = x + y < MAP_SIZE ? 'top side' : 'bot side';
  if (Math.abs(x - y) < RIVER_BAND) {
    return `in the ${sideOfMid} river`;
  }
  const halfOwner = x < y ? TEAM.BLUE : TEAM.RED;
  const ownership = halfOwner === perspectiveTeam ? 'your' : 'their';
  return `in ${ownership} ${sideOfMid} jungle`;
}
