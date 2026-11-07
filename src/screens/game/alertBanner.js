import { createElement } from '../../ui/dom.js';
import { playExitAnimation, replayAnimationClass } from '../../ui/motion.js';

const ALERT_VISIBLE_MS = 3500;

export function createAlertBanner() {
  const element = createElement('div', { className: 'alert-banner', attributes: { role: 'alert' } });
  element.hidden = true;
  let hideTimer = null;
  // Counts shown alerts, so an exit animation that finishes after a newer alert appeared does not hide it.
  let alertNumber = 0;

  function show(text, isMajor) {
    alertNumber += 1;
    clearTimeout(hideTimer);
    element.classList.remove('is-leaving');
    element.textContent = text;
    element.classList.toggle('alert-banner--major', isMajor);
    element.hidden = false;
    replayAnimationClass(element, 'is-entering');
    hideTimer = setTimeout(hide, ALERT_VISIBLE_MS);
  }

  function hide() {
    const hiddenAlertNumber = alertNumber;
    playExitAnimation(element).then(() => {
      if (hiddenAlertNumber === alertNumber) {
        element.hidden = true;
        element.classList.remove('is-leaving');
      }
    });
  }

  function destroy() {
    clearTimeout(hideTimer);
  }

  return { element, show, destroy };
}
