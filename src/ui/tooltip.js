import { createElement } from './dom.js';
import { placeNear } from './placement.js';

const SHOW_DELAY_MS = 300;
// Moving straight from one button to the next shows the next tooltip at once.
const WARM_WINDOW_MS = 400;
const TOOLTIP_ID = 'app-tooltip';

let tooltipElement = null;
let titleElement = null;
let bodyElement = null;
let activeTarget = null;
let pendingTarget = null;
let showTimer = null;
let followFrameId = null;
let lastHiddenAt = -Infinity;

// One shared tooltip element for the whole app.
// content is { title, body } or a function returning that (read each time the tooltip opens).
export function attachTooltip(target, content) {
  target.addEventListener('mouseenter', () => scheduleShow(target, content));
  target.addEventListener('mouseleave', () => hideTooltip(target));
  target.addEventListener('focus', () => {
    if (target.matches(':focus-visible')) {
      showTooltip(target, content);
    }
  });
  target.addEventListener('blur', () => hideTooltip(target));
  target.addEventListener('click', () => hideTooltip(target));
}

function scheduleShow(target, content) {
  clearTimeout(showTimer);
  if (performance.now() - lastHiddenAt < WARM_WINDOW_MS) {
    showTooltip(target, content);
    return;
  }
  pendingTarget = target;
  showTimer = setTimeout(() => showTooltip(target, content), SHOW_DELAY_MS);
}

function showTooltip(target, content) {
  clearTimeout(showTimer);
  pendingTarget = null;
  ensureTooltipElement();
  const { title = '', body = '' } = typeof content === 'function' ? content() : content;
  titleElement.textContent = title;
  titleElement.hidden = !title;
  bodyElement.textContent = body;
  activeTarget?.removeAttribute('aria-describedby');
  activeTarget = target;
  target.setAttribute('aria-describedby', TOOLTIP_ID);
  tooltipElement.classList.add('is-visible');
  positionTooltip();
  cancelAnimationFrame(followFrameId);
  followFrameId = requestAnimationFrame(followTarget);
}

function hideTooltip(target) {
  if (pendingTarget === target) {
    clearTimeout(showTimer);
    pendingTarget = null;
  }
  if (!activeTarget || activeTarget !== target) {
    return;
  }
  activeTarget.removeAttribute('aria-describedby');
  activeTarget = null;
  lastHiddenAt = performance.now();
  tooltipElement.classList.remove('is-visible');
  cancelAnimationFrame(followFrameId);
}

// Keeps the tooltip on its target while it is open, and closes it if the target disappears
// (hidden, or removed when the screen changes).
function followTarget() {
  if (!activeTarget) {
    return;
  }
  if (!activeTarget.isConnected || activeTarget.getClientRects().length === 0) {
    hideTooltip(activeTarget);
    return;
  }
  positionTooltip();
  followFrameId = requestAnimationFrame(followTarget);
}

function positionTooltip() {
  const size = { width: tooltipElement.offsetWidth, height: tooltipElement.offsetHeight };
  const { left, top, side } = placeNear(activeTarget.getBoundingClientRect(), size, { preferredSide: 'top' });
  tooltipElement.style.left = `${Math.round(left)}px`;
  tooltipElement.style.top = `${Math.round(top)}px`;
  tooltipElement.dataset.side = side;
}

function ensureTooltipElement() {
  if (tooltipElement) {
    return;
  }
  titleElement = createElement('span', { className: 'tooltip__title' });
  bodyElement = createElement('span', { className: 'tooltip__body' });
  tooltipElement = createElement('div', { className: 'tooltip', attributes: { id: TOOLTIP_ID, role: 'tooltip' } }, titleElement, bodyElement);
  document.body.append(tooltipElement);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeTarget) {
      hideTooltip(activeTarget);
    }
  });
}
