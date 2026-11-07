import { createButton, createElement } from '../../ui/dom.js';
import { paddedRect, roundedRectPath } from '../../ui/geometry.js';
import { placeNear } from '../../ui/placement.js';
import { replayAnimationClass } from '../../ui/motion.js';
import { STEP_KIND } from '../tutorialRunner.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const HOLE_PADDING = 6;
const HOLE_RADIUS = 8;
const CARD_GAP = 14;
const KIND_STATUS = Object.freeze({
  [STEP_KIND.DO]: 'Your move',
  [STEP_KIND.WATCH]: 'Watch',
  [STEP_KIND.SKIP]: 'Skipping ahead',
  [STEP_KIND.FREE]: 'Free play',
});
const DIMMING_KINDS = new Set([STEP_KIND.DIALOG, STEP_KIND.DO, STEP_KIND.SKIP]);

// The tutorial's guide on screen: a dark layer with holes over what to look at, a pulsing ring
// around each hole, and a card with the step's text. Clicks on the dark part are blocked; clicks
// in a hole reach the page (where the tutorial still decides what is allowed).
// findTargetRects(step) returns the rectangles to highlight, in viewport pixels.
export function createCoachMark({ findTargetRects, onNext, onExit }) {
  const shade = document.createElementNS(SVG_NAMESPACE, 'path');
  shade.setAttribute('class', 'coach-layer__shade');
  shade.setAttribute('fill-rule', 'evenodd');
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('class', 'coach-layer__svg');
  svg.append(shade);
  const rings = createElement('div', { className: 'coach-layer__rings' });
  const card = createCoachCard({ onNext, onExit });
  const layer = createElement('div', { className: 'coach-layer' }, svg, rings, card.element);
  layer.hidden = true;
  document.body.append(layer);
  let shownStep = null;
  let followFrameId = null;

  function show(step) {
    shownStep = step;
    layer.dataset.kind = step.kind;
    layer.hidden = false;
    card.fill(step);
    cancelAnimationFrame(followFrameId);
    follow();
  }

  // Targets can move (resize, scroll, a map that pans), so the layer follows them every frame.
  function follow() {
    const targetRects = findTargetRects(shownStep).map(rect => paddedRect(rect, HOLE_PADDING));
    drawShade(shade, DIMMING_KINDS.has(shownStep.kind) ? targetRects : null);
    drawRings(rings, targetRects);
    card.placeBeside(targetRects[0] ?? null, shownStep.kind);
    followFrameId = requestAnimationFrame(follow);
  }

  function hide() {
    shownStep = null;
    layer.hidden = true;
    cancelAnimationFrame(followFrameId);
  }

  function destroy() {
    hide();
    card.destroy();
    layer.remove();
  }

  return { show, hide, destroy, shake: () => replayAnimationClass(card.element, 'is-shaking') };
}

// The dark layer is the whole viewport with every target cut out of it (evenodd fill).
function drawShade(shade, holeRects) {
  if (!holeRects) {
    shade.setAttribute('d', '');
    return;
  }
  const viewport = `M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z`;
  shade.setAttribute('d', [viewport, ...holeRects.map(rect => roundedRectPath(rect, HOLE_RADIUS))].join(' '));
}

function drawRings(rings, rects) {
  while (rings.children.length < rects.length) {
    rings.append(createElement('div', { className: 'coach-ring' }));
  }
  [...rings.children].forEach((ring, index) => {
    const rect = rects[index];
    ring.hidden = !rect;
    if (rect) {
      Object.assign(ring.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    }
  });
}

function createCoachCard({ onNext, onExit }) {
  const chapterLabel = createElement('span', { className: 'coach-card__chapter' });
  const statusLabel = createElement('span', { className: 'coach-card__status' });
  const title = createElement('h2', { className: 'coach-card__title' });
  const body = createElement('p', { className: 'coach-card__body' });
  const nextButton = createButton('Next', onNext, 'button button--primary coach-card__next');
  const exitButton = createButton('Exit tutorial', onExit, 'coach-card__exit');
  const element = createElement('section', { className: 'coach-card', attributes: { 'aria-live': 'polite', 'aria-label': 'Tutorial' } },
    createElement('header', { className: 'coach-card__header' }, chapterLabel, statusLabel),
    title,
    body,
    createElement('footer', { className: 'coach-card__footer' }, exitButton, nextButton),
  );
  // Enter anywhere means Next. A focused button or field already handles Enter itself (Next included),
  // so those are skipped; otherwise one key press would move on twice.
  const handleKeyDown = event => {
    const isHandledByFocusedControl = Boolean(event.target.closest?.('button, input, select, textarea, dialog'));
    if (event.key === 'Enter' && !nextButton.hidden && !isHandledByFocusedControl) {
      event.preventDefault();
      onNext();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  function fill(step) {
    chapterLabel.textContent = step.chapter ? `Chapter ${step.chapter.number} · ${step.chapter.title}` : '';
    statusLabel.textContent = KIND_STATUS[step.kind] ?? '';
    title.textContent = step.title;
    body.textContent = step.body;
    nextButton.hidden = step.kind !== STEP_KIND.DIALOG;
    if (!nextButton.hidden) {
      nextButton.focus({ preventScroll: true });
    }
  }

  // Watch and free steps keep the card in a corner, out of the way; others sit beside their target.
  function placeBeside(targetRect, kind) {
    const isCornerCard = kind === STEP_KIND.WATCH || kind === STEP_KIND.FREE;
    element.classList.toggle('coach-card--corner', isCornerCard);
    element.classList.toggle('coach-card--centered', !isCornerCard && !targetRect);
    if (isCornerCard || !targetRect) {
      element.style.removeProperty('left');
      element.style.removeProperty('top');
      return;
    }
    const { left, top } = placeNear(targetRect, { width: element.offsetWidth, height: element.offsetHeight }, { preferredSide: 'bottom', gap: CARD_GAP });
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }

  return { element, fill, placeBeside, destroy: () => window.removeEventListener('keydown', handleKeyDown) };
}
