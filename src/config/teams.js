export const TEAM = Object.freeze({ BLUE: 'blue', RED: 'red' });

export const TEAM_LABELS = Object.freeze({ blue: 'Blue', red: 'Red' });

export function opposingTeam(team) {
  return team === TEAM.BLUE ? TEAM.RED : TEAM.BLUE;
}

export function randomTeam() {
  return Math.random() < 0.5 ? TEAM.BLUE : TEAM.RED;
}
