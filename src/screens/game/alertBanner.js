import { createElement } from '../../ui/dom.js';

const ALERT_VISIBLE_MS = 3500;

export function createAlertBanner() {
  const element = createElement('div', { className: 'alert-banner', attributes: { role: 'alert' } });
  element.hidden = true;
  let hideTimer = null;

  function show(text, isMajor) {
    element.textContent = text;
    element.classList.toggle('alert-banner--major', isMajor);
    element.hidden = false;
    element.classList.remove('is-entering');
    void element.offsetWidth;
    element.classList.add('is-entering');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      element.hidden = true;
    }, ALERT_VISIBLE_MS);
  }

  function destroy() {
    clearTimeout(hideTimer);
  }

  return { element, show, destroy };
}
