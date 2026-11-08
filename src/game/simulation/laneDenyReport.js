import { LOST_CREEPS_REPORT_COOLDOWN_SECONDS, LOST_CREEPS_REPORT_MINIMUM, LOST_CREEPS_TOWER_RANGE } from '../../config/laneRules.js';
import { ROLE } from '../../config/roles.js';
import { TEAM, opposingTeam } from '../../config/teams.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { LANE_BY_ROLE } from '../mapLayout.js';
import { frontStructureOf, laneDistanceOfStructure } from '../structures.js';

const TEAMS = Object.freeze([TEAM.BLUE, TEAM.RED]);

// Tells the kill feed when a wave cost a laner their farm, so the player sees the consequence of a
// crash or of being away. Only losses with a cause count, because a laner misses a minion now and
// then anyway and a message for each would drown out everything else: the minion must have died
// while the laner was away, or under their own tower. The sum is reported when the wave is over.
export function reportLostCreeps(gameState, laneState, { deadMinions, championsAtWave }) {
  for (const minion of deadMinions.filter(candidate => !candidate.wasLastHit)) {
    const team = opposingTeam(minion.team);
    const isAway = isLaneFarmerAway(championsAtWave[team]);
    if (isAway || isUnderTowerOf(gameState, laneState, { team, minion })) {
      laneState.unclaimedMinions[team] += 1;
      laneState.minionsLostWhileAway[team] += isAway ? 1 : 0;
    }
  }
  for (const team of TEAMS.filter(candidate => laneState.minions[opposingTeam(candidate)] === 0)) {
    reportAndReset(gameState, laneState, team);
  }
}

function isLaneFarmerAway(championsAtWave) {
  return !championsAtWave.some(championState => championState.role !== ROLE.SUPPORT);
}

function isUnderTowerOf(gameState, laneState, { team, minion }) {
  const tower = frontStructureOf(gameState, team, laneState.lane);
  return Boolean(tower) && Math.abs(laneDistanceOfStructure(tower, laneState.lane) - minion.laneDistance) <= LOST_CREEPS_TOWER_RANGE;
}

function reportAndReset(gameState, laneState, team) {
  const lostCreeps = laneState.unclaimedMinions[team];
  const lostWhileAway = laneState.minionsLostWhileAway[team];
  laneState.unclaimedMinions[team] = 0;
  laneState.minionsLostWhileAway[team] = 0;
  const isCoolingDown = gameState.gameSeconds < laneState.nextLostCreepsReportSeconds[team];
  if (lostCreeps < LOST_CREEPS_REPORT_MINIMUM || isCoolingDown) {
    return;
  }
  laneState.nextLostCreepsReportSeconds[team] = gameState.gameSeconds + LOST_CREEPS_REPORT_COOLDOWN_SECONDS;
  const laner = gameState.teams[team].champions.find(championState => championState.role !== ROLE.SUPPORT
    && LANE_BY_ROLE[championState.role] === laneState.lane);
  const cause = lostWhileAway * 2 > lostCreeps ? 'while away from' : 'under their tower in';
  addEvent(gameState, { kind: EVENT_KIND.CALL, team: opposingTeam(team), text: `${laner.champion.name} lost ${lostCreeps} CS ${cause} ${laneState.lane}` });
}
