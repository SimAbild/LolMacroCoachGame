import { INTENT } from '../../core/intents.js';
import { STEP_KIND } from '../tutorialRunner.js';

// Small builders so the chapter files read like a script. Every step has an id, the screen it is
// shown on, a title and a body. `target` is what to highlight: a CSS selector, a point on the map
// (see mapTarget), or a list of those.

export function inChapter(number, title, steps) {
  return steps.map(step => ({ ...step, chapter: { number, title } }));
}

// next: the step to go to instead of the following one (to rejoin after a branch).
// nextLabel: the button's text, when "Next" would not be true (the very last step).
export function dialogStep(id, { screen, title, body, target = null, next = null, nextLabel = null }) {
  return { id, kind: STEP_KIND.DIALOG, screen, title, body, target, next, nextLabel };
}

export function doStep(id, { screen, title, body, target, expect, allow = [] }) {
  return { id, kind: STEP_KIND.DO, screen, title, body, target, expect, allow };
}

// onEnter(context) runs once when the step starts (e.g. to start a deadline); next may be a
// function of the context to branch on what happened.
export function watchStep(id, { screen, title, body, until, allow = [], target = null, onEnter = null, next = null }) {
  return { id, kind: STEP_KIND.WATCH, screen, title, body, until, allow, target, onEnter, next };
}

// Jumps the game forward to `toSeconds`, then applies `patch(context)` to set up the next lesson.
// onEnter(context) runs before the jump, for what must already be true during the skipped time.
export function skipStep(id, { title, body, toSeconds, patch = null, onEnter = null }) {
  return { id, kind: STEP_KIND.SKIP, screen: 'game', title, body, toSeconds, patch, onEnter };
}

// autopilotCall: the call tools repeat here, standing in for a player who makes their own.
export function freeStep(id, { screen, title, body, until = null, next = null, autopilotCall = null }) {
  return { id, kind: STEP_KIND.FREE, screen, title, body, until, next, autopilotCall };
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

export function ownCard(role) {
  return `.champion-card.is-own[data-role="${role}"]`;
}

export function enemyCard(role) {
  return `.champion-card:not(.is-own)[data-role="${role}"]`;
}

// A circle on the map around a point in map units (MAP_SIZE square).
export function mapTarget(mapPoint, radius) {
  return { mapPoint, radius };
}
