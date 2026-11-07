// Shows every new alert from the simulation exactly once, and reports the major ones
// (the game screen slows the game down for those).
export function createAlertWatcher({ banner, onMajorAlert }) {
  let shownAlertCount = 0;

  function showNewAlerts(gameState) {
    while (shownAlertCount < gameState.alerts.length) {
      const alert = gameState.alerts[shownAlertCount];
      banner.show(alert.text, alert.isMajor);
      shownAlertCount += 1;
      if (alert.isMajor) {
        onMajorAlert(alert);
      }
    }
  }

  return { showNewAlerts };
}
