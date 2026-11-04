import { TEAM } from './teams.js';

export const DRAFT_ACTION = Object.freeze({ BAN: 'ban', PICK: 'pick' });

const { BLUE, RED } = TEAM;
const { BAN, PICK } = DRAFT_ACTION;

export const DRAFT_PHASES = Object.freeze([
  { name: 'Ban phase 1', firstStepIndex: 0 },
  { name: 'Pick phase 1', firstStepIndex: 6 },
  { name: 'Ban phase 2', firstStepIndex: 12 },
  { name: 'Pick phase 2', firstStepIndex: 16 },
]);

export const DRAFT_STEPS = Object.freeze([
  { team: BLUE, action: BAN, slotIndex: 0, label: '1' },
  { team: RED, action: BAN, slotIndex: 0, label: '2' },
  { team: BLUE, action: BAN, slotIndex: 1, label: '3' },
  { team: RED, action: BAN, slotIndex: 1, label: '4' },
  { team: BLUE, action: BAN, slotIndex: 2, label: '5' },
  { team: RED, action: BAN, slotIndex: 2, label: '6' },
  { team: BLUE, action: PICK, slotIndex: 0, label: 'B1' },
  { team: RED, action: PICK, slotIndex: 0, label: 'R1' },
  { team: RED, action: PICK, slotIndex: 1, label: 'R2' },
  { team: BLUE, action: PICK, slotIndex: 1, label: 'B2' },
  { team: BLUE, action: PICK, slotIndex: 2, label: 'B3' },
  { team: RED, action: PICK, slotIndex: 2, label: 'R3' },
  { team: RED, action: BAN, slotIndex: 3, label: '7' },
  { team: BLUE, action: BAN, slotIndex: 3, label: '8' },
  { team: RED, action: BAN, slotIndex: 4, label: '9' },
  { team: BLUE, action: BAN, slotIndex: 4, label: '10' },
  { team: RED, action: PICK, slotIndex: 3, label: 'R4' },
  { team: BLUE, action: PICK, slotIndex: 3, label: 'B4' },
  { team: BLUE, action: PICK, slotIndex: 4, label: 'B5' },
  { team: RED, action: PICK, slotIndex: 4, label: 'R5' },
]);

export const PICKS_PER_TEAM = 5;

export function banLabelsFor(team) {
  return DRAFT_STEPS.filter(step => step.team === team && step.action === BAN).map(step => step.label);
}

export function phaseNameForStep(stepIndex) {
  const phasesStartedSoFar = DRAFT_PHASES.filter(phase => phase.firstStepIndex <= stepIndex);
  return phasesStartedSoFar[phasesStartedSoFar.length - 1].name;
}
