import { createElement } from './dom.js';
import { playExitAnimation, replayAnimationClass } from './motion.js';

export const TOAST_VARIANT = Object.freeze({ INFO: 'info', WARNING: 'warning', ERROR: 'error' });

const TOAST_VISIBLE_MS = 2600;
const MAX_VISIBLE_TOASTS = 3;

let stackElement = null;
// Oldest first. Toasts that are playing their exit animation are no longer in this list.
const visibleToasts = [];

// Shows a short message in the toast stack. The same message again does not stack
// a copy: it restarts the timer and counts up (×2, ×3), so spamming a blocked call stays readable.
export function showToast(message, { variant = TOAST_VARIANT.INFO, durationMs = TOAST_VISIBLE_MS } = {}) {
  const key = `${variant}|${message}`;
  const repeatedToast = visibleToasts.find(toast => toast.key === key);
  if (repeatedToast) {
    countRepeat(repeatedToast);
    scheduleDismiss(repeatedToast, durationMs);
    return;
  }
  if (visibleToasts.length >= MAX_VISIBLE_TOASTS) {
    dismissToast(visibleToasts[0]);
  }
  const toast = createToast({ key, message, variant });
  visibleToasts.push(toast);
  ensureStackElement().append(toast.element);
  scheduleDismiss(toast, durationMs);
}

function createToast({ key, message, variant }) {
  const countLabel = createElement('span', { className: 'toast__count' });
  countLabel.hidden = true;
  const element = createElement('div', { className: `toast toast--${variant}`, dataset: { variant } },
    createElement('span', { className: 'toast__message', text: message }),
    countLabel,
  );
  return { key, element, countLabel, count: 1, dismissTimer: null };
}

function countRepeat(toast) {
  toast.count += 1;
  toast.countLabel.textContent = `×${toast.count}`;
  toast.countLabel.hidden = false;
  replayAnimationClass(toast.element, 'is-bumped');
}

// A screen can host the stack in one of its own elements and position it with its own CSS,
// e.g. the game screen keeps toasts inside the map so they never cover the call buttons.
// Returns a function that moves the stack back to <body>.
export function setToastHost(hostElement) {
  const stack = ensureStackElement();
  hostElement.append(stack);
  return () => document.body.append(stack);
}

// Used when a screen unmounts, so its messages do not linger on the next screen.
export function dismissAllToasts() {
  for (const toast of [...visibleToasts]) {
    dismissToast(toast);
  }
}

function scheduleDismiss(toast, durationMs) {
  clearTimeout(toast.dismissTimer);
  toast.dismissTimer = setTimeout(() => dismissToast(toast), durationMs);
}

function dismissToast(toast) {
  const index = visibleToasts.indexOf(toast);
  if (index === -1) {
    return;
  }
  visibleToasts.splice(index, 1);
  clearTimeout(toast.dismissTimer);
  playExitAnimation(toast.element).then(() => toast.element.remove());
}

// The oldest toast sits furthest from the anchored edge, so when it leaves, the others do not move.
function ensureStackElement() {
  if (!stackElement) {
    stackElement = createElement('div', {
      className: 'toast-stack',
      attributes: { role: 'status', 'aria-live': 'polite' },
    });
    document.body.append(stackElement);
  }
  return stackElement;
}
