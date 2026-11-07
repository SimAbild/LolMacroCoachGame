import { opposingTeam } from '../../config/teams.js';
import { ACTION_KIND, TEAM_CALL } from '../../config/actions.js';
import { OBJECTIVE_LABELS } from '../../config/objectiveRules.js';
import { ACTIVITY } from '../activities.js';
import { chooseObjectiveToContest } from '../objectives.js';
import { isPositionVisible, visionSourcesFor } from '../vision.js';
import { cancelAction, startRetreat, startTeamAction } from './actionSystem.js';
import { orderRetreat } from './teamfightSystem.js';
import { distanceBetween } from '../geometry.js';

const TEAM_ACTION_KINDS = Object.freeze([ACTION_KIND.GROUP, ACTION_KIND.CONTEST, ACTION_KIND.ENGAGE]);

export function issueTeamCall(gameState, team, teamCallId) {
  const members = availableMembers(gameState, team);
  if (members.length === 0) {
    return { isIssued: false, reason: 'Nobody is available' };
  }
  return TEAM_CALL_HANDLERS[teamCallId](gameState, team, members);
}

export function isTeamBusyWith(gameState, team, actionKind) {
  return gameState.teams[team].champions.some(championState => championState.activeAction?.kind === actionKind);
}

const TEAM_CALL_HANDLERS = Object.freeze({
  [TEAM_CALL.GROUP_MID]: (gameState, team, members) => {
    members.forEach((championState, spreadIndex) => {
      cancelAction(gameState, championState);
      startTeamAction(championState, { kind: ACTION_KIND.GROUP, label: 'Group mid', lane: 'mid', spreadIndex });
    });
    return { isIssued: true };
  },
  [TEAM_CALL.CONTEST_OBJECTIVE]: (gameState, team, members) => {
    const objective = chooseObjectiveToContest(gameState);
    if (!objective) {
      return { isIssued: false, reason: 'No objective is up or spawning soon' };
    }
    members.forEach((championState, spreadIndex) => {
      cancelAction(gameState, championState);
      startTeamAction(championState, {
        kind: ACTION_KIND.CONTEST,
        label: OBJECTIVE_LABELS[objective.key],
        objectiveKey: objective.key,
        spreadIndex,
        issuedAtSeconds: gameState.gameSeconds,
      });
    });
    return { isIssued: true };
  },
  [TEAM_CALL.ENGAGE]: (gameState, team, members) => {
    const target = closestVisibleEnemy(gameState, team, members);
    if (!target) {
      return { isIssued: false, reason: 'No visible enemy to engage' };
    }
    for (const championState of members) {
      cancelAction(gameState, championState);
      startTeamAction(championState, { kind: ACTION_KIND.ENGAGE, label: 'Engage', targetId: target.id, phase: 'approach' });
    }
    return { isIssued: true };
  },
  [TEAM_CALL.BACK_OFF]: (gameState, team) => {
    for (const championState of gameState.teams[team].champions.filter(candidate => candidate.isAlive)) {
      if (championState.inFightId) {
        orderRetreat(gameState, championState);
      } else if (TEAM_ACTION_KINDS.includes(championState.activeAction?.kind)) {
        startRetreat(gameState, championState);
      }
    }
    return { isIssued: true };
  },
});

function availableMembers(gameState, team) {
  return gameState.teams[team].champions.filter(championState => championState.isAlive && championState.activity !== ACTIVITY.IN_FOUNTAIN);
}

function closestVisibleEnemy(gameState, team, members) {
  const teamVision = visionSourcesFor(gameState, team);
  const centroid = {
    x: members.reduce((sum, member) => sum + member.position.x, 0) / members.length,
    y: members.reduce((sum, member) => sum + member.position.y, 0) / members.length,
  };
  const visibleEnemies = gameState.teams[opposingTeam(team)].champions.filter(enemy => enemy.isAlive
    && enemy.activity !== ACTIVITY.IN_FOUNTAIN
    && isPositionVisible(enemy.position, teamVision));
  if (visibleEnemies.length === 0) {
    return null;
  }
  const distanceToCentroid = enemy => distanceBetween(enemy.position, centroid);
  return visibleEnemies.reduce((closest, enemy) => (distanceToCentroid(enemy) < distanceToCentroid(closest) ? enemy : closest));
}
