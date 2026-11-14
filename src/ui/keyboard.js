const TYPING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

// A single-key shortcut must not fire while the player types, inside a dialog, or with a modifier
// held (those combinations belong to the browser).
export function shouldIgnoreShortcut(event) {
  const target = event.target;
  const isTyping = target instanceof HTMLElement && (target.isContentEditable || TYPING_TAGS.has(target.tagName));
  const isInsideDialog = target instanceof Element && Boolean(target.closest('dialog'));
  return isTyping || isInsideDialog || event.altKey || event.ctrlKey || event.metaKey;
}
