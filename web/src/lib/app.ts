import { ensureSession } from "./auth";
import { initShell, renderShell } from "./shell";
import { subscribeSession } from "./session";
import { initTelegram } from "./telegram";

const controllers: Record<string, () => Promise<unknown>> = {
  follows: () => import("./pages/follows-page"),
  online: () => import("./pages/online-page"),
  add: () => import("./pages/add-page"),
  settings: () => import("./pages/settings-page"),
  follow: () => import("./pages/follow-page"),
  admin: () => import("./pages/admin-page"),
  "admin-users": () => import("./pages/admin-users-page"),
  "admin-user": () => import("./pages/admin-user-page"),
  "admin-channels": () => import("./pages/admin-channels-page"),
  "admin-follows": () => import("./pages/admin-follows-page"),
  "admin-logs": () => import("./pages/admin-logs-page"),
  "admin-keys": () => import("./pages/admin-keys-page"),
  "admin-broadcast": () => import("./pages/admin-broadcast-page"),
  "admin-infra": () => import("./pages/admin-infra-page"),
};

/**
 * Loads only the current page's controller. Dynamic imports keep one page's
 * handlers out of every other page's bundle.
 */
function loadPageController(): void {
  const page = document.querySelector<HTMLElement>("[data-page]")?.dataset.page;
  if (!page) return;
  void controllers[page]?.();
}

let started = false;

function start(): void {
  if (started) return;
  started = true;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  initTelegram();
  initShell();
  subscribeSession(renderShell);
  renderShell();
  void ensureSession();
  loadPageController();

  document.addEventListener("astro:page-load", () => {
    initTelegram();
    renderShell();
    loadPageController();
  });

  document.addEventListener("astro:after-swap", () => {
    document.getElementById("app-main")?.scrollTo({ top: 0 });
    window.scrollTo(0, 0);
  });
}

start();
