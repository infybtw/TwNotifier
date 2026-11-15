import { api } from "./api";
import { ensureSession } from "./auth";
import { session } from "./session";
import type { Platform } from "./types";

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
  platform: Platform;
  channelId: string;
  name: string;
  login: string;
  followers: number;
}

export interface AdminUserSettings {
  language: "ru" | "en";
  onlineNotification: boolean;
  offlineNotification: boolean;
  titleChangeNotification: boolean;
  categoryChangeNotification: boolean;
  streamMetadata: boolean;
  linkPreview: boolean;
}

export interface AdminUserDetail {
  id: string;
  username: string | null;
  firstName: string | null;
  created: string;
  isAdmin: boolean;
  isBotBlocked: boolean;
  chatDelivery: "unknown" | "enabled" | "blocked";
  settings: AdminUserSettings;
  follows: number;
  notifications: number;
}

export interface AdminUserFollow {
  platform: Platform;
  channelId: string;
  channelName: string;
  channelLogin: string;
  created: string;
}

export interface AdminUserNotification {
  id: number;
  platform: Platform | null;
  channelId: string | null;
  channelName: string | null;
  event: string;
  status: "sent" | "blocked" | "failed";
  created: string;
}

export interface AdminFollow {
  userId: string;
  username: string | null;
  firstName: string | null;
  platform: Platform;
  channelId: string;
  channelName: string;
  created: string;
}

export interface AdminLog {
  id: number;
  platform: Platform;
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

export interface EventSubReconnect {
  id: number;
  startedAt: string;
  finishedAt: string;
  reason:
    | "socket_closed"
    | "keepalive_timeout"
    | "session_reconnect"
    | "reconnect_url_failed"
    | "bind_failed"
    | "connect_failed";
  status: "connected" | "failed";
  attempt: number;
  delayMs: number;
  closeCode: number | null;
  closeReason: string | null;
  details: string | null;
  error: string | null;
  previousSessionId: string | null;
  sessionId: string | null;
}

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Admin timezone offset (hours) shared across admin pages. */
export const adminState = { utcOffset: 0 };

export function formatAdminDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const shifted = new Date(date.getTime() + adminState.utcOffset * 3_600_000);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${pad(shifted.getUTCDate())}.${pad(shifted.getUTCMonth() + 1)}.${shifted.getUTCFullYear()} `
    + `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

export async function loadAdminSettings(): Promise<void> {
  const response = await api.get<{ utcOffset: number }>("/admin/settings");
  adminState.utcOffset = response.utcOffset;
}

export function adminOverview(): Promise<AdminStats> {
  return api.get<AdminStats>("/admin/overview");
}

export function adminUsers(
  opts: { search?: string; cursor?: string | null; limit?: number } = {},
): Promise<Page<AdminUser>> {
  return api.get<Page<AdminUser>>("/admin/users", {
    search: opts.search,
    cursor: opts.cursor ?? undefined,
    limit: opts.limit,
  });
}

export function adminUserDetail(id: string): Promise<AdminUserDetail> {
  return api.get<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`);
}

export function adminUserFollows(
  id: string,
  cursor?: string | null,
  limit?: number,
): Promise<Page<AdminUserFollow>> {
  return api.get<Page<AdminUserFollow>>(`/admin/users/${encodeURIComponent(id)}/follows`, {
    cursor: cursor ?? undefined,
    limit,
  });
}

export function adminUserNotifications(
  id: string,
  cursor?: string | null,
  limit?: number,
): Promise<Page<AdminUserNotification>> {
  return api.get<Page<AdminUserNotification>>(`/admin/users/${encodeURIComponent(id)}/notifications`, {
    cursor: cursor ?? undefined,
    limit,
  });
}

export function adminUpdateUser(
  id: string,
  patch: { isAdmin?: boolean; isBotBlocked?: boolean },
): Promise<{ id: string; isAdmin: boolean; isBotBlocked: boolean }> {
  return api.patch<{ id: string; isAdmin: boolean; isBotBlocked: boolean }>(
    `/admin/users/${encodeURIComponent(id)}`,
    patch,
  );
}

export function adminChannels(
  opts: { platform?: string; cursor?: string | null; limit?: number } = {},
): Promise<Page<AdminChannel>> {
  return api.get<Page<AdminChannel>>("/admin/channels", {
    platform: opts.platform,
    cursor: opts.cursor ?? undefined,
    limit: opts.limit,
  });
}

export function adminFollows(cursor?: string | null, limit?: number): Promise<Page<AdminFollow>> {
  return api.get<Page<AdminFollow>>("/admin/follows", {
    cursor: cursor ?? undefined,
    limit,
  });
}

export function adminLogs(): Promise<{ items: AdminLog[] }> {
  return api.get<{ items: AdminLog[] }>("/admin/logs");
}

export function adminKeys(): Promise<{ items: AdminKeyItem[] }> {
  return api.get<{ items: AdminKeyItem[] }>("/admin/keys");
}

export function adminCreateKey(): Promise<AdminKeyItem> {
  return api.post<AdminKeyItem>("/admin/keys");
}

export function adminRevokeKey(id: number): Promise<{ revoked: boolean }> {
  return api.del<{ revoked: boolean }>(`/admin/keys/${id}`);
}

export function adminBroadcast(
  text: string,
  photo: File | null,
): Promise<{ sent: number; failed: number }> {
  const form = new FormData();
  if (text) form.set("text", text);
  if (photo) form.set("photo", photo);
  return api.postForm<{ sent: number; failed: number }>("/admin/broadcast", form);
}

export function adminEventSubStatus(): Promise<EventSubStatus> {
  return api.get<EventSubStatus>("/admin/eventsub");
}

export function adminEventSubReconnects(): Promise<{ items: EventSubReconnect[] }> {
  return api.get<{ items: EventSubReconnect[] }>("/admin/eventsub/reconnects");
}

export function adminEventSubReload(): Promise<{ before: number; after: number }> {
  return api.post<{ before: number; after: number }>("/admin/eventsub/reload");
}

export function adminEventSubDisconnect(): Promise<{ deleted: number }> {
  return api.post<{ deleted: number }>("/admin/eventsub/disconnect");
}

export function adminEventSubCleanup(): Promise<{ total: number; removed: number; remaining: number }> {
  return api.post<{ total: number; removed: number; remaining: number }>("/admin/eventsub/cleanup");
}

export function adminWebhookStatus(): Promise<KickWebhookStatus> {
  return api.get<KickWebhookStatus>("/admin/webhook");
}

export function adminWebhookReload(): Promise<{ before: number; after: number }> {
  return api.post<{ before: number; after: number }>("/admin/webhook/reload");
}

export function adminWebhookDisconnect(): Promise<{ deleted: number }> {
  return api.post<{ deleted: number }>("/admin/webhook/disconnect");
}

export function adminWebhookCleanup(): Promise<{ total: number; removed: number; remaining: number }> {
  return api.post<{ total: number; removed: number; remaining: number }>("/admin/webhook/cleanup");
}

export function adminSaveTimezone(offset: number): Promise<{ utcOffset: number }> {
  return api.patch<{ utcOffset: number }>("/admin/settings", { utcOffset: offset });
}

export function adminRestart(): Promise<{ restarting: boolean }> {
  return api.post<{ restarting: boolean }>("/admin/restart");
}

/**
 * Admin pages are guarded server-side by the API; this only avoids flashing
 * restricted UI. Must run before a page controller loads its data.
 */
export async function requireAdmin(): Promise<boolean> {
  const authenticated = await ensureSession();
  if (!authenticated) return false;
  if (!session.profile?.isAdmin) {
    window.location.replace("/");
    return false;
  }
  return true;
}
