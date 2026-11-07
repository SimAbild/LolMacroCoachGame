import { DRAFT_STEPS } from '../../config/draftOrder.js';
import { scriptEntryFor } from '../scenario.js';
import { dialogStep, inChapter, lockInStep, opponentTurnsStep } from './stepBuilders.js';

// Chapter 1: the tournament draft. The player bans and picks the scripted champions; the opponent
// plays its side from the same script. `draftScript` is resolved for the current patch.
export function createDraftChapter(draftScript) {
  const champion = name => scriptEntryFor(draftScript, name);
  const nameOf = name => champion(name).champion.name;
  return inChapter(1, 'The draft', [
    dialogStep('draft.welcome', {
      screen: 'draft',
      title: 'Welcome, coach',
      body: 'In Macro Coach you never control a champion. You draft a team, then make the calls: who ganks, who wards, '
        + 'when the team takes an objective or fights. This guided game shows you how, one step at a time.',
    }),
    dialogStep('draft.order', {
      screen: 'draft',
      title: 'Tournament draft',
      target: ['.draft-footer', '.pick-column'],
      body: 'Each team bans three champions, then picks three (Blue 1, Red 2, Blue 2, Red 1). Then two more bans each '
        + 'and the last two picks. The glowing slot shows whose turn it is. You are Blue and go first.',
    }),
    lockInStep('draft.banFirst', {
      entry: champion('Zed'),
      title: 'Ban a threat',
      body: `A ban removes a champion for both teams. ${nameOf('Zed')} is an assassin who could pick off our carries. Click him, then press Ban.`,
    }),
    opponentTurnsStep('draft.redBan1', { untilStepIndex: 2, title: 'Red bans', body: `Red bans ${nameOf('Sejuani')}, a jungler. Their bans show what they fear.` }),
    lockInStep('draft.banSecond', {
      entry: champion('Yasuo'),
      title: 'Ban a threat',
      body: `${nameOf('Yasuo')} is another carry that is hard to catch. Ban him. Tip: a double-click bans at once.`,
    }),
    opponentTurnsStep('draft.redBan2', { untilStepIndex: 4, title: 'Red bans', body: `Red bans ${nameOf('Vi')}: two junglers gone. They are aiming at our jungle pool.` }),
    lockInStep('draft.banThird', { entry: champion('Thresh'), title: 'Ban a threat', body: `${nameOf('Thresh')} is a support who makes plays out of nothing. Ban him.` }),
    opponentTurnsStep('draft.redBan3', { untilStepIndex: DRAFT_STEPS.findIndex(step => step.label === 'B1'), title: 'Red bans', body: `Red bans ${nameOf('Amumu')}. The first ban phase is over.` }),
    dialogStep('draft.picks', {
      screen: 'draft',
      title: 'Picks',
      target: '.pick-column--blue',
      body: 'Now the picks. A good team has a frontline that can start fights, damage from range, '
        + 'and a jungler who can gank. You pick first.',
    }),
    ...pickPhaseOneSteps(champion, nameOf),
    ...banPhaseTwoSteps(champion, nameOf),
    ...pickPhaseTwoSteps(champion, nameOf),
  ]);
}

function pickPhaseOneSteps(champion, nameOf) {
  return [
    lockInStep('draft.pickFirst', {
      entry: champion('Volibear'),
      title: 'First pick',
      body: `${nameOf('Volibear')} is a tough fighter who can play top or jungle. A flexible first pick hides your plan. Pick him.`,
    }),
    opponentTurnsStep('draft.redPicks1', {
      untilStepIndex: DRAFT_STEPS.findIndex(step => step.label === 'B2'),
      title: 'Red picks',
      body: `Red picks ${nameOf('Jinx')} and ${nameOf('Nunu & Willump')}: a carry who grows strong late, and a jungler.`,
    }),
    lockInStep('draft.pickSecond', { entry: champion('Orianna'), title: 'Two picks in a row', body: `${nameOf('Orianna')}: a mid laner whose ultimate wins teamfights.` }),
    lockInStep('draft.pickThird', { entry: champion('Ezreal'), title: 'Two picks in a row', body: `${nameOf('Ezreal')}: a safe ranged carry for the bot lane.` }),
    opponentTurnsStep('draft.redPick3', {
      untilStepIndex: DRAFT_STEPS.findIndex(step => step.label === '8'),
      title: 'Red picks and bans',
      body: `Red picks ${nameOf('Ahri')} for mid and opens the second ban phase by banning ${nameOf('Lux')}.`,
    }),
  ];
}

function banPhaseTwoSteps(champion, nameOf) {
  return [
    lockInStep('draft.banFourth', {
      entry: champion('Darius'),
      title: 'Second ban phase',
      body: `Ban what you still fear. ${nameOf('Darius')} would bully our top lane. Ban him.`,
    }),
    opponentTurnsStep('draft.redBan5', { untilStepIndex: DRAFT_STEPS.findIndex(step => step.label === '10'), title: 'Red bans', body: `Red bans ${nameOf('Galio')}.` }),
    lockInStep('draft.banFifth', { entry: champion('Nami'), title: 'Second ban phase', body: `Ban ${nameOf('Nami')}, a support who would make ${nameOf('Jinx')} even stronger.` }),
  ];
}

function pickPhaseTwoSteps(champion, nameOf) {
  return [
    opponentTurnsStep('draft.redPick4', {
      untilStepIndex: DRAFT_STEPS.findIndex(step => step.label === 'B4'),
      title: 'Red picks',
      body: `Red picks ${nameOf('Soraka')}, a healer to keep ${nameOf('Jinx')} alive.`,
    }),
    lockInStep('draft.pickFourth', { entry: champion('Leona'), title: 'Last picks', body: `${nameOf('Leona')} is a tank support who starts fights. Pick her.` }),
    lockInStep('draft.pickFifth', {
      entry: champion('Malphite'),
      title: 'Last picks',
      body: `${nameOf('Malphite')}: his ultimate can hit the whole enemy team. Notice we have no clear top laner or jungler yet. You fix that next.`,
    }),
    opponentTurnsStep('draft.redPick5', {
      untilStepIndex: DRAFT_STEPS.length,
      title: 'Red picks',
      body: `Red's last pick is ${nameOf('Jayce')} for top. The draft is done.`,
    }),
  ];
}
