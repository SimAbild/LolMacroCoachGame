export function createScreenRouter(rootElement) {
  let cleanUpCurrentScreen = null;

  const router = {
    show(mountScreen, context = {}) {
      cleanUpCurrentScreen?.();
      rootElement.replaceChildren();
      cleanUpCurrentScreen = mountScreen(rootElement, { ...context, router }) ?? null;
    },
  };

  return router;
}
