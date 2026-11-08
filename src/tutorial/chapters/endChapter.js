import { dialogStep, inChapter } from './stepBuilders.js';

const SCREEN = 'end';

// Chapter 9: reading the end screen. Finishing the last step marks the tutorial as completed
// and unlocks the buttons at the bottom.
export const END_CHAPTER = Object.freeze(inChapter(9, 'The end screen', [
  dialogStep('end.victory', {
    screen: SCREEN,
    title: 'Victory',
    target: '.end-header',
    body: 'You won, and you made the calls that did it. Here is how to read what happened.',
    next: 'end.gold',
  }),
  dialogStep('end.defeat', {
    screen: SCREEN,
    title: 'Defeat',
    target: '.end-header',
    body: 'Even a big lead can slip away, and now you know how it happens. Here is how to read what went on.',
  }),
  dialogStep('end.gold', {
    screen: SCREEN,
    title: 'The gold chart',
    target: '.end-screen > .end-panel',
    body: 'The line shows which team was ahead in gold, minute by minute. Each diamond is a call you made, '
      + 'so you can see where your calls paid off. Hover the chart for exact values.',
  }),
  dialogStep('end.teams', {
    screen: SCREEN,
    title: 'The teams',
    target: '.end-teams',
    body: 'What each team took, and every champion\'s score, gold and items.',
  }),
  dialogStep('end.finish', {
    screen: SCREEN,
    title: 'You are ready',
    target: '.end-actions',
    body: 'That is the whole game: draft, lanes, ganks, vision, objectives, and the push to the Nexus. '
      + 'In a real game Red has a coach of its own, and nobody stops the clock for you. Good luck!',
    nextLabel: 'Finish',
  }),
]));
