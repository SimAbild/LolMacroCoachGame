const SECONDS_PER_MINUTE = 60;

export function formatGameTime(gameSeconds) {
  const minutes = Math.floor(gameSeconds / SECONDS_PER_MINUTE);
  const seconds = Math.floor(gameSeconds % SECONDS_PER_MINUTE);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
