import { LOST_CREEPS_REPORT_MINIMUM } from '../../config/laneRules.js';
import { ROLE } from '../../config/roles.js';
import { TEAM, TEAM_LABELS, opposingTeam } from '../../config/teams.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { LANE_BY_ROLE } from '../mapLayout.js';

const TEAMS = Object.freeze([TEAM.BLUE, TEAM.RED]);

// Tells the kill feed when a wave cost a laner farm: every enemy minion that died without their
// last hit counts, and the sum is reported once no enemy minions are left near the front. This
// is how the player sees the consequence of a crash, a freeze, or being away from the lane.
export function reportLostCreeps(gameState, laneState, deadMinions) {
  for (const minion of deadMinions.filter(candidate => !candidate.wasLastHit)) {
    laneState.unclaimedMinions[opposingTeam(minion.team)] += 1;
  }
  for (const team of TEAMS) {
    const isWaveOver = laneState.minions[opposingTeam(team)] === 0;
    if (isWaveOver) {
      reportAndReset(gameState, laneState, team);
    }
  }
}

function reportAndReset(gameState, laneState, team) {
  const lostCreeps = laneState.unclaimedMinions[team];
  laneState.unclaimedMinions[team] = 0;
  if (lostCreeps < LOST_CREEPS_REPORT_MINIMUM) {
    return;
  }
  const laner = laneFarmerOf(gameState, laneState, team);
  addEvent(gameState, {
    kind: EVENT_KIND.CALL,
    team: opposingTeam(team),
    text: `${laner?.champion.name ?? TEAM_LABELS[team]} lost ${lostCreeps} CS in ${laneState.lane}`,
  });
}

function laneFarmerOf(gameState, laneState, team) {
  return gameState.teams[team].champions.find(championState => championState.role !== ROLE.SUPPORT
    && LANE_BY_ROLE[championState.role] === laneState.lane);
}
