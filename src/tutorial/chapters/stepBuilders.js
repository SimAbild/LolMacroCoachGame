import { INTENT } from '../../core/intents.js';
import { STEP_KIND } from '../tutorialRunner.js';

// Small builders so the chapter files read like a script. Every step has an id, the screen it is
// shown on, a title and a body; `target` is a CSS selector (or a list) for what to highlight.

export function inChapter(number, title, steps) {
  return steps.map(step => ({ ...step, chapter: { number, title } }));
}

export function dialogStep(id, { screen, title, body, target = null }) {
  return { id, kind: STEP_KIND.DIALOG, screen, title, body, target };
}

export function doStep(id, { screen, title, body, target, expect, allow = [] }) {
  return { id, kind: STEP_KIND.DO, screen, title, body, target, expect, allow };
}

export function watchStep(id, { screen, title, body, until, allow = [], target = null }) {
  return { id, kind: STEP_KIND.WATCH, screen, title, body, until, allow, target };
}

export function freeStep(id, { screen, title, body, until = null }) {
  return { id, kind: STEP_KIND.FREE, screen, title, body, until };
}

// Draft: select the scripted champion and lock it in (by the button or a double-click).
export function lockInStep(id, { entry, title, body }) {
  return doStep(id, {
    screen: 'draft',
    title,
    body,
    target: [championTile(entry.champion.id), '[data-anchor="lock-in"]'],
    expect: { type: INTENT.DRAFT_LOCK, championId: entry.champion.id },
    allow: [{ type: INTENT.DRAFT_SELECT, championId: entry.champion.id }],
  });
}

// Draft: let the opponent take its turns until the draft reaches `stepIndex`.
export function opponentTurnsStep(id, { untilStepIndex, title, body }) {
  return watchStep(id, {
    screen: 'draft',
    title,
    body,
    allow: [{ type: INTENT.DRAFT_AI_TURN }],
    until: ({ draftState }) => draftState.stepIndex >= untilStepIndex,
  });
}

export function championTile(championId) {
  return `[data-champion-id="${championId}"]`;
}
