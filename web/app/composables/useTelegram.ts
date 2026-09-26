import type { TelegramWebApp } from "../types/telegram";

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

/**
 * Thin typed wrapper around the Telegram bridge. All values are computed on
 * first access and are stable for the lifetime of the page.
 */
export function useTelegram() {
  const wa = getTelegramWebApp();
  const unsafe = wa?.initDataUnsafe;

  const state: TelegramState = {
    available: Boolean(wa),
    initData: wa?.initData ?? "",
    startParam: unsafe?.start_param ?? null,
    languageCode: unsafe?.user?.language_code ?? null,
    allowsWriteToPm: unsafe?.user?.allows_write_to_pm === true,
    platform: wa?.platform ?? "unknown",
  };

  function openExternal(url: string): void {
    if (wa && /^https?:\/\//.test(url) && !url.includes("t.me/")) {
      wa.openLink(url);
    } else if (wa && url.includes("t.me/")) {
      wa.openTelegramLink(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  function openTelegramLink(url: string): void {
    if (wa) wa.openTelegramLink(url);
    else window.open(url, "_blank", "noopener");
  }

  /** Client-side signal only; the backend trusts server-side updates instead. */
  function requestWriteAccess(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!wa?.requestWriteAccess) {
        resolve(false);
        return;
      }
      wa.requestWriteAccess((granted) => resolve(granted));
    });
  }

  return { wa, state, openExternal, openTelegramLink, requestWriteAccess };
}
