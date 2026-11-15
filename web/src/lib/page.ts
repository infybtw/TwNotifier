/**
 * Page controllers run once on first load and on later client-side visits.
 * Each controller guards on its own root element, so duplicate visits do not
 * double-bind handlers.
 */
export function onPage(init: () => void): void {
  const run = (): void => {
    if (document.readyState !== "loading") init();
  };
  document.addEventListener("astro:page-load", run);
  run();
}

/** Aborts page-scoped listeners when the router swaps the document. */
export function pageSignal(): AbortSignal {
  const controller = new AbortController();
  document.addEventListener("astro:before-swap", () => controller.abort(), { once: true });
  return controller.signal;
}
