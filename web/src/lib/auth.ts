import { api, ApiError } from "./api";
import { localeFromTelegram, setLocale } from "./i18n";
import { notifySession, session } from "./session";
import { telegramState } from "./telegram";
import type { AuthResponse, Profile, Settings } from "./types";

function applySettings(next: Settings): void {
  session.settings = next;
  setLocale(next.language);
}

function isAuthenticated(): boolean {
  return Boolean(session.token && session.profile);
}

async function exchangeInitData(): Promise<boolean> {
  const tg = telegramState();
  if (!tg.available) {
    session.authError = "not_telegram";
    return false;
  }
  if (!tg.initData) {
    session.authError = "no_init_data";
    return false;
  }

  try {
    const data = await api.post<AuthResponse>("/auth/telegram", { initData: tg.initData });
    if (!data?.token) {
      session.authError = "failed";
      return false;
    }

    session.token = data.token;
    session.profile = data.profile;
    applySettings(data.settings);

    // A brand new user starts from Telegram's language suggestion.
    if (data.isNew) {
      const suggested = localeFromTelegram(tg.languageCode);
      setLocale(suggested);
      if (suggested !== data.settings.language) {
        try {
          applySettings(await api.patch<Settings>("/settings", { language: suggested }));
        } catch {
          // The suggestion is best-effort; the default remains saved.
        }
      }
    }

    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "SESSION_EXPIRED" || error.status === 401) session.authError = "expired";
      else if (error.code === "NETWORK") session.authError = "network";
      else session.authError = "failed";
    } else {
      session.authError = "failed";
    }
    return false;
  }
}

async function signIn(): Promise<boolean> {
  if (session.signingIn) return isAuthenticated();
  session.signingIn = true;
  session.authError = null;
  notifySession();

  let ok = false;
  try {
    ok = await exchangeInitData();
  } finally {
    session.signingIn = false;
    session.initialized = true;
    notifySession();
  }
  return ok;
}

let pending: Promise<boolean> | null = null;

/**
 * Starts the Telegram initData exchange once per page lifetime. Page
 * controllers await this before loading data; callers share the same promise.
 */
export function ensureSession(): Promise<boolean> {
  if (isAuthenticated()) return Promise.resolve(true);
  if (pending) return pending;
  if (session.initialized && session.authError) return Promise.resolve(false);

  pending = signIn().finally(() => {
    pending = null;
  });
  return pending;
}

/** Explicit retry from the onboarding screen. */
export function retrySignIn(): Promise<boolean> {
  pending = null;
  session.initialized = false;
  session.authError = null;
  return ensureSession();
}

export async function refreshProfile(): Promise<void> {
  if (!session.token) return;
  session.profile = await api.get<Profile>("/me");
  notifySession();
}

export async function refreshSettings(): Promise<void> {
  if (!session.token) return;
  applySettings(await api.get<Settings>("/settings"));
  notifySession();
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = await api.patch<Settings>("/settings", patch);
  applySettings(next);
  notifySession();
  return next;
}

export { isAuthenticated };
