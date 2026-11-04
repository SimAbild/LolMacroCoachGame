import { createElement } from './dom.js';

const TOAST_VISIBLE_MS = 2600;

export function showToast(message) {
  const toast = createElement('div', { className: 'toast', text: message, attributes: { role: 'status' } });
  document.body.append(toast);
  setTimeout(() => toast.remove(), TOAST_VISIBLE_MS);
}
