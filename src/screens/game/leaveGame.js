import { DIALOG_TONE, confirmDialog } from '../../ui/dialog.js';
import { PAUSE_REASON } from '../../game/gameClock.js';

// Asks before a running game is left. The game holds still while the player decides. The dialog
// has its own pause reason, so cancelling only lifts that one: a game the player had paused stays paused.
export async function confirmLeaveGame({ clock, signal }) {
  clock.pause(PAUSE_REASON.DIALOG);
  const isLeaving = await confirmDialog({
    title: 'Leave the game?',
    body: 'The game is paused. If you leave now, this game ends and you go back to the home screen.',
    confirmLabel: 'Leave game',
    cancelLabel: 'Keep playing',
    tone: DIALOG_TONE.DANGER,
    signal,
  });
  if (!isLeaving) {
    clock.resume(PAUSE_REASON.DIALOG);
  }
  return isLeaving;
}
