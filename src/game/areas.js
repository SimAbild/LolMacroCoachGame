import { TEAM } from '../config/teams.js';
import { MAP_SIZE } from './mapLayout.js';

const MID_LANE_BAND = 90;
const RIVER_BAND = 70;
const SIDE_LANE_BAND = 130;
const BASE_BAND = 260;

export function describeArea(position, perspectiveTeam) {
  const { x, y } = position;
  const sideOfMid = x + y < MAP_SIZE ? 'top side' : 'bot side';
  if (x < BASE_BAND && y > MAP_SIZE - BASE_BAND) {
    return perspectiveTeam === TEAM.BLUE ? 'in your base' : 'in their base';
  }
  if (x > MAP_SIZE - BASE_BAND && y < BASE_BAND) {
    return perspectiveTeam === TEAM.RED ? 'in your base' : 'in their base';
  }
  if (x < SIDE_LANE_BAND || y < SIDE_LANE_BAND) {
    return 'top lane';
  }
  if (x > MAP_SIZE - SIDE_LANE_BAND || y > MAP_SIZE - SIDE_LANE_BAND) {
    return 'bot lane';
  }
  if (Math.abs(x + y - MAP_SIZE) < MID_LANE_BAND) {
    return 'mid lane';
  }
  if (Math.abs(x - y) < RIVER_BAND) {
    return `in the ${sideOfMid} river`;
  }
  const halfOwner = x < y ? TEAM.BLUE : TEAM.RED;
  const ownership = halfOwner === perspectiveTeam ? 'your' : 'their';
  return `in ${ownership} ${sideOfMid} jungle`;
}
