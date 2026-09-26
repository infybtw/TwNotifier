import { ApiError, useApi } from "./useApi";
import { useLocale } from "./useLocale";
import { useTelegram } from "./useTelegram";

export interface ApiCapabilities {
  titleChange: boolean;
  categoryChange: boolean;
}

export interface Profile {
  id: string;
  username: string | null;
  firstName: string | null;
  language: "ru" | "en";
  isAdmin: boolean;
  chatDelivery: "unknown" | "enabled" | "blocked";
  isBotBlocked: boolean;
  capabilities: Record<"twitch" | "kick", ApiCapabilities>;
}

export interface Settings {
  onlineNotification: boolean;
  offlineNotification: boolean;
  titleChangeNotification: boolean;
  categoryChangeNotification: boolean;
  streamMetadata: boolean;
  linkPreview: boolean;
  language: "ru" | "en";
}

interface AuthResponse {
  token: string;
  expiresAt: string;
  isNew: boolean;
  profile: Profile;
  settings: Settings;
}

export function useAuth() {
  const config = useRuntimeConfig();
  const api = useApi();
  const tg = useTelegram();
  const { setLocale, localeFromTelegram } = useLocale();

  const token = useState<string | null>("auth-token", () => null);
  const profile = useState<Profile | null>("profile", () => null);
  const settings = useState<Settings | null>("settings", () => null);
  const authError = useState<string | null>("auth-error", () => null);
  const signingIn = useState<boolean>("auth-signing-in", () => false);
  const initialized = useState<boolean>("auth-initialized", () => false);

  const isAuthenticated = computed(() => Boolean(token.value && profile.value));

  function applySettings(next: Settings): void {
    settings.value = next;
    setLocale(next.language);
  }

  async function signIn(): Promise<void> {
    if (signingIn.value) return;
    signingIn.value = true;
    authError.value = null;
    try {
      if (!tg.state.available) {
        authError.value = "not_telegram";
        return;
      }
      if (!tg.state.initData) {
        authError.value = "no_init_data";
        return;
      }

      const response = await fetch(`${config.public.apiBase}/auth/telegram`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: tg.state.initData }),
      });
      const data = (await response.json().catch(() => null)) as (AuthResponse & { error?: { code?: string } }) | null;

      if (!response.ok || !data?.token) {
        authError.value = data?.error?.code === "SESSION_EXPIRED" ? "expired" : "failed";
        return;
      }

      token.value = data.token;
      profile.value = data.profile;
      applySettings(data.settings);

      // A brand new user starts from Telegram's language suggestion.
      if (data.isNew) {
        const suggested = localeFromTelegram(tg.state.languageCode);
        setLocale(suggested);
        if (suggested !== data.settings.language) {
          try {
            applySettings(await api.patch<Settings>("/settings", { language: suggested }));
          } catch {
            // The suggestion is best-effort; the default remains saved.
          }
        }
      }
    } catch (error) {
      authError.value = error instanceof ApiError && error.code === "NETWORK" ? "network" : "failed";
    } finally {
      signingIn.value = false;
      initialized.value = true;
    }
  }

  async function refreshProfile(): Promise<void> {
    if (!token.value) return;
    profile.value = await api.get<Profile>("/me");
  }

  async function refreshSettings(): Promise<void> {
    if (!token.value) return;
    applySettings(await api.get<Settings>("/settings"));
  }

  async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = await api.patch<Settings>("/settings", patch);
    applySettings(next);
    return next;
  }

  async function signOut(): Promise<void> {
    try {
      if (token.value) await api.del("/auth/session");
    } catch {
      // Revocation is best-effort; the local token is discarded regardless.
    }
    token.value = null;
    profile.value = null;
    settings.value = null;
  }

  return {
    token,
    profile,
    settings,
    authError,
    signingIn,
    initialized,
    isAuthenticated,
    signIn,
    refreshProfile,
    refreshSettings,
    saveSettings,
    signOut,
  };
}
