import type { TelegramWebApp } from "./telegram-types";

let cachedWebApp: TelegramWebApp | null | undefined;

/** Returns the Telegram bridge instance, or null outside Telegram. */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (cachedWebApp !== undefined) return cachedWebApp;
  if (typeof window === "undefined") return (cachedWebApp = null);
  cachedWebApp = window.Telegram?.WebApp ?? null;
  return cachedWebApp;
}

function setVar(name: string, value: string | undefined): void {
  if (value) document.documentElement.style.setProperty(name, value);
}

/**
 * The app ships its own dark violet theme, so Telegram theme params are not
 * mapped onto colors. Only safe areas are applied, and the Telegram chrome is
 * tinted to match the palette.
 */
export function applyTelegramTheme(wa: TelegramWebApp): void {
  wa.setHeaderColor?.("#0c0913");
  wa.setBackgroundColor?.("#0c0913");

  const inset = wa.contentSafeAreaInset ?? wa.safeAreaInset;
  if (inset) {
    setVar("--safe-top", `${inset.top}px`);
    setVar("--safe-bottom", `${inset.bottom}px`);
  }

  document.documentElement.dataset.theme = "dark";
}

export interface TelegramState {
  available: boolean;
  initData: string;
  startParam: string | null;
  languageCode: string | null;
  allowsWriteToPm: boolean;
  platform: string;
}

/** Values are stable for the lifetime of the page. */
export function telegramState(): TelegramState {
  const wa = getTelegramWebApp();
  const unsafe = wa?.initDataUnsafe;
  return {
    available: Boolean(wa),
    initData: wa?.initData ?? "",
    startParam: unsafe?.start_param ?? null,
    languageCode: unsafe?.user?.language_code ?? null,
    allowsWriteToPm: unsafe?.user?.allows_write_to_pm === true,
    platform: wa?.platform ?? "unknown",
  };
}

export function openExternal(url: string): void {
  const wa = getTelegramWebApp();
  if (wa && /^https?:\/\//.test(url) && !url.includes("t.me/")) {
    wa.openLink(url);
  } else if (wa && url.includes("t.me/")) {
    wa.openTelegramLink(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

export function openTelegramLink(url: string): void {
  const wa = getTelegramWebApp();
  if (wa) wa.openTelegramLink(url);
  else window.open(url, "_blank", "noopener");
}

/** Client-side signal only; the backend trusts server-side updates instead. */
export function requestWriteAccess(): Promise<boolean> {
  return new Promise((resolve) => {
    const wa = getTelegramWebApp();
    if (!wa?.requestWriteAccess) {
      resolve(false);
      return;
    }
    wa.requestWriteAccess((granted) => resolve(granted));
  });
}

let initialized = false;

function updateBackButton(): void {
  const wa = getTelegramWebApp();
  if (!wa) return;
  if (window.location.pathname === "/") wa.BackButton.hide();
  else wa.BackButton.show();
}

const onBack = (): void => {
  if (window.history.length > 1) window.history.back();
};

/**
 * Wires the Telegram bridge once per document. The bridge and its listeners
 * survive client-side navigations; only the back-button visibility follows
 * the new route.
 */
export function initTelegram(): void {
  const wa = getTelegramWebApp();
  if (!wa) return;

  if (!initialized) {
    initialized = true;
    wa.ready();
    wa.expand();
    applyTelegramTheme(wa);

    const onThemeChanged = (): void => applyTelegramTheme(wa);
    wa.onEvent("themeChanged", onThemeChanged);
    wa.onEvent("viewportChanged", onThemeChanged);
    wa.BackButton.onClick(onBack);
    document.addEventListener("astro:page-load", updateBackButton);

    window.addEventListener("pagehide", () => {
      wa.offEvent("themeChanged", onThemeChanged);
      wa.offEvent("viewportChanged", onThemeChanged);
      wa.BackButton.offClick(onBack);
    }, { once: true });
  }

  updateBackButton();
}
