import { createElement } from './dom.js';
import { shouldIgnoreShortcut } from './keyboard.js';
import { attachTooltip } from './tooltip.js';

const SHORTCUT_KEY = 'f';
const ICONS = Object.freeze({
  enter: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>',
  exit: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M10 14v-4h4M6 14v-4H2"/></svg>',
});

// The app's one button and the place it lives, so a screen can borrow it (hostFullscreenToggle).
let mountedToggle = null;

// The fullscreen button and the F key, mounted once for the whole app, outside the screens, so it
// survives every screen change. The browser reports every change, Esc included, with a
// fullscreenchange event, so the button reads document.fullscreenElement instead of keeping a state
// of its own. Where fullscreen is not allowed, nothing is added. Returns a function that removes it.
export function mountFullscreenToggle(parent) {
  if (!document.fullscreenEnabled) {
    return () => {};
  }
  const button = createToggleButton();
  const showState = () => showFullscreenState(button);
  document.addEventListener('fullscreenchange', showState);
  window.addEventListener('keydown', toggleOnShortcutKey);
  showState();
  parent.append(button);
  mountedToggle = { button, home: parent };
  return () => {
    document.removeEventListener('fullscreenchange', showState);
    window.removeEventListener('keydown', toggleOnShortcutKey);
    button.remove();
    mountedToggle = null;
  };
}

// Moves the app's fullscreen button into a screen's own place for it, and returns a function that
// puts it back. Moving rather than copying keeps one button and one F key, and its tooltip stays
// attached. Where fullscreen is not allowed there is no button, so there is nothing to move.
export function hostFullscreenToggle(slot) {
  if (!mountedToggle) {
    return () => {};
  }
  const { button, home } = mountedToggle;
  slot.append(button);
  return () => {
    if (mountedToggle?.button === button) {
      home.append(button);
    }
  };
}

function createToggleButton() {
  const button = createElement('button', {
    className: 'fullscreen-toggle',
    attributes: { type: 'button', 'aria-label': 'Fullscreen (F)' },
  });
  button.addEventListener('click', toggleFullscreen);
  attachTooltip(button, () => ({
    title: document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen',
    body: 'Shortcut: F. Esc also leaves fullscreen.',
  }));
  return button;
}

function showFullscreenState(button) {
  const isFullscreen = Boolean(document.fullscreenElement);
  button.innerHTML = isFullscreen ? ICONS.exit : ICONS.enter;
  button.setAttribute('aria-pressed', String(isFullscreen));
}

function toggleOnShortcutKey(event) {
  if (event.key?.toLowerCase() === SHORTCUT_KEY && !event.repeat && !shouldIgnoreShortcut(event)) {
    toggleFullscreen();
  }
}

function toggleFullscreen() {
  const change = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  // The browser may refuse, for example when the request did not come from a click or key press.
  // Nothing to undo: the button only changes on fullscreenchange, so it still shows the real state.
  change.catch(error => console.warn(`Fullscreen was refused: ${error.message}`));
}
