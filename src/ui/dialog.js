import { createElement } from './dom.js';
import { playExitAnimation } from './motion.js';

export const DIALOG_TONE = Object.freeze({ PRIMARY: 'primary', DANGER: 'danger' });

let dialogCount = 0;

// Opens a modal confirm dialog. Resolves true when confirmed, and false on Cancel, Esc,
// a click on the backdrop, or when `signal` aborts (e.g. the screen behind it unmounts).
// The native <dialog> with showModal() gives the top layer, Esc, a focus trap and an inert page.
export function confirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = DIALOG_TONE.PRIMARY,
  signal,
}) {
  if (signal?.aborted) {
    return Promise.resolve(false);
  }

  dialogCount += 1;
  const titleId = `dialog-title-${dialogCount}`;
  const bodyId = `dialog-body-${dialogCount}`;
  // The safe choice gets focus first, so Enter right after opening never confirms by accident.
  const cancelButton = createElement('button', {
    className: 'button',
    text: cancelLabel,
    attributes: { type: 'button', autofocus: '' },
    dataset: { dialogAction: 'cancel' },
  });
  const confirmButton = createElement('button', {
    className: `button button--${tone}`,
    text: confirmLabel,
    attributes: { type: 'button' },
    dataset: { dialogAction: 'confirm' },
  });
  const dialog = createElement('dialog', {
    className: 'dialog-card',
    attributes: { 'aria-labelledby': titleId, 'aria-describedby': bodyId },
  },
  createElement('div', { className: 'dialog-card__content' },
    createElement('h2', { className: 'dialog-card__title', text: title, attributes: { id: titleId } }),
    createElement('p', { className: 'dialog-card__body', text: body, attributes: { id: bodyId } }),
    createElement('div', { className: 'dialog-card__actions' }, cancelButton, confirmButton),
  ));

  return new Promise(resolve => {
    let pendingResult = null;
    let isSettled = false;
    let didPressBackdrop = false;

    function closeWith(result) {
      if (pendingResult !== null) {
        return;
      }
      pendingResult = result;
      playExitAnimation(dialog, 'is-closing').then(() => settle(result));
    }

    function settle(result) {
      if (isSettled) {
        return;
      }
      isSettled = true;
      signal?.removeEventListener('abort', handleAbort);
      if (dialog.open) {
        dialog.close();
      }
      dialog.remove();
      resolve(result);
    }

    function handleAbort() {
      settle(false);
    }

    cancelButton.addEventListener('click', () => closeWith(false));
    confirmButton.addEventListener('click', () => closeWith(true));
    // Esc: run our own exit animation instead of the browser closing the dialog at once.
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeWith(false);
    });
    // Browsers may refuse to cancel a second Esc in a row and close the dialog themselves.
    dialog.addEventListener('close', () => settle(pendingResult ?? false));
    // The content fills the dialog box, so a click whose target is the dialog itself hit the backdrop.
    // Both press and release must be there, so dragging a text selection out of the card does not close it.
    dialog.addEventListener('pointerdown', event => {
      didPressBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog && didPressBackdrop) {
        closeWith(false);
      }
    });
    signal?.addEventListener('abort', handleAbort, { once: true });

    document.body.append(dialog);
    dialog.showModal();
  });
}
