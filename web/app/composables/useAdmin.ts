import { useApi } from "./useApi";

export interface AdminStats {
  users: number;
  blockedUsers: number;
  admins: number;
  channels: number;
  twitchChannels: number;
  kickChannels: number;
  follows: number;
}

export interface AdminUser {
  id: string;
  username: string | null;
  firstName: string | null;
  created: string;
  isAdmin: boolean;
  isBotBlocked: boolean;
  follows: number;
}

export interface AdminChannel {
  platform: "twitch" | "kick";
  channelId: string;
  name: string;
  login: string;
  followers: number;
}

export interface AdminFollow {
  userId: string;
  username: string | null;
  firstName: string | null;
  platform: "twitch" | "kick";
  channelId: string;
  channelName: string;
  created: string;
}

export interface AdminLog {
  id: number;
  platform: "twitch" | "kick";
  channelId: string;
  channelName: string | null;
  event: string;
  followers: number;
  created: string;
}

export interface AdminKeyItem {
  id: number;
  key: string;
  issueDate: string;
  issuedBy: string;
  issuedByName: string | null;
  issuedByUsername: string | null;
  used: boolean;
  usedDate: string | null;
  usedBy: string | null;
}

export interface EventSubStatus {
  total: number;
  online: number;
  offline: number;
  transport: string;
}

export interface KickWebhookStatus {
  total: number;
  livestream: number;
}

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Admin API access. Every endpoint is guarded server-side by the persistent
 * `users.is_admin` flag; the client guard below only keeps the UI tidy.
 */
export function useAdmin() {
  const api = useApi();

  /** Admin timezone offset (hours) shared across admin pages. */
  const utcOffset = useState<number>("admin-utc-offset", () => 0);

  function formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const shifted = new Date(date.getTime() + utcOffset.value * 3_600_000);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(shifted.getUTCDate())}.${pad(shifted.getUTCMonth() + 1)}.${shifted.getUTCFullYear()} `
      + `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
  }

  async function loadSettings(): Promise<void> {
    const response = await api.get<{ utcOffset: number }>("/admin/settings");
    utcOffset.value = response.utcOffset;
  }

  return {
    utcOffset,
    formatDate,
    loadSettings,
    overview: () => api.get<AdminStats>("/admin/overview"),
    users: (opts: { search?: string; cursor?: string | null } = {}) =>
      api.get<Page<AdminUser>>("/admin/users", { search: opts.search, cursor: opts.cursor ?? undefined }),
    channels: (opts: { platform?: string; cursor?: string | null } = {}) =>
      api.get<Page<AdminChannel>>("/admin/channels", { platform: opts.platform, cursor: opts.cursor ?? undefined }),
    follows: (cursor?: string | null) =>
      api.get<Page<AdminFollow>>("/admin/follows", { cursor: cursor ?? undefined }),
    logs: () => api.get<{ items: AdminLog[] }>("/admin/logs"),
    keys: () => api.get<{ items: AdminKeyItem[] }>("/admin/keys"),
    createKey: () => api.post<AdminKeyItem>("/admin/keys"),
    revokeKey: (id: number) => api.del<{ revoked: boolean }>(`/admin/keys/${id}`),
    broadcast: (text: string, photo: File | null) => {
      const form = new FormData();
      if (text) form.set("text", text);
      if (photo) form.set("photo", photo);
      return api.postForm<{ sent: number; failed: number }>("/admin/broadcast", form);
    },
    eventSubStatus: () => api.get<EventSubStatus>("/admin/eventsub"),
    eventSubReload: () => api.post<{ before: number; after: number }>("/admin/eventsub/reload"),
    eventSubDisconnect: () => api.post<{ deleted: number }>("/admin/eventsub/disconnect"),
    eventSubCleanup: () => api.post<{ total: number; removed: number; remaining: number }>("/admin/eventsub/cleanup"),
    webhookStatus: () => api.get<KickWebhookStatus>("/admin/webhook"),
    webhookReload: () => api.post<{ before: number; after: number }>("/admin/webhook/reload"),
    webhookDisconnect: () => api.post<{ deleted: number }>("/admin/webhook/disconnect"),
    webhookCleanup: () => api.post<{ total: number; removed: number; remaining: number }>("/admin/webhook/cleanup"),
    saveTimezone: (offset: number) => api.patch<{ utcOffset: number }>("/admin/settings", { utcOffset: offset }),
    restart: () => api.post<{ restarting: boolean }>("/admin/restart"),
  };
}

/**
 * Redirects non-admins away from /admin pages. The API independently rejects
 * them with 403, this only avoids flashing restricted UI.
 */
export function useAdminGuard() {
  const { profile, isAuthenticated } = useAuth();
  const router = useRouter();
  watch([profile, isAuthenticated], () => {
    if (isAuthenticated.value && profile.value && !profile.value.isAdmin) {
      void router.replace("/");
    }
  }, { immediate: true });
}
