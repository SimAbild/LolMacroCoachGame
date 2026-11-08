import { GAME_SPEEDS, GAME_SPEED_KEYS } from '../../game/gameClock.js';

const TYPING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

// Space toggles pause, 0 to 3 set the speed. Returns a function that removes the listeners.
export function attachGameShortcuts({ onTogglePause, onSpeedChange }) {
  function handleKeyDown(event) {
    if (shouldIgnore(event)) {
      return;
    }
    if (event.code === 'Space') {
      // Stops Space from also scrolling the page or clicking the focused button.
      event.preventDefault();
      if (!event.repeat) {
        onTogglePause();
      }
      return;
    }
    const speedIndex = GAME_SPEED_KEYS.indexOf(event.key);
    if (speedIndex !== -1 && !event.repeat) {
      onSpeedChange(GAME_SPEEDS[speedIndex]);
    }
  }

  function handleKeyUp(event) {
    if (event.code === 'Space' && !shouldIgnore(event)) {
      event.preventDefault();
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}

function shouldIgnore(event) {
  const target = event.target;
  const isTyping = target instanceof HTMLElement && (target.isContentEditable || TYPING_TAGS.has(target.tagName));
  const isInsideDialog = target instanceof Element && Boolean(target.closest('dialog'));
  return isTyping || isInsideDialog || event.altKey || event.ctrlKey || event.metaKey;
}
