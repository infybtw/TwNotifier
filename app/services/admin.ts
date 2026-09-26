import { randomBytes } from "node:crypto";
import { addAdminKey, getChannelFollowersByChannelIdAndPlatform, getChannelsWithFollowersByPlatform } from "../database/db";
import type { AdminKey } from "../database/schema";
import { TWITCH_EVENT_TRANSPORT } from "../config";
import {
  deleteSubs,
  getEventSubList,
  subscribeAllChannelUpdates,
  subscribeAllStreamsOffline,
  subscribeAllStreamsOnline,
} from "../twitchAPI/subscriptions";
import {
  deleteKickSubscriptions,
  getKickSubscriptions,
  subscribeToKickChannelsOnline,
} from "../kickAPI/subscription";
import logger from "../logger";

const log = logger.getSubLogger({ name: "services:admin" });

/** Pause between subscription teardown and re-creation, mirroring the bot flow. */
const RESUBSCRIBE_DELAY_MS = 2_500;

export interface EventSubStatus {
  total: number;
  online: number;
  offline: number;
  transport: string;
}

export async function getEventSubStatus(): Promise<EventSubStatus> {
  const subs = await getEventSubList();
  return {
    total: subs.length,
    online: subs.filter((sub) => sub.type === "stream.online").length,
    offline: subs.filter((sub) => sub.type === "stream.offline").length,
    transport: TWITCH_EVENT_TRANSPORT || "websocket",
  };
}

/** Deletes every EventSub subscription and re-subscribes from scratch. */
export async function reloadEventSub(adminId: number): Promise<{ before: number; after: number }> {
  const subs = await getEventSubList();
  await deleteSubs(subs);
  await new Promise((resolve) => setTimeout(resolve, RESUBSCRIBE_DELAY_MS));
  await subscribeAllStreamsOnline();
  await subscribeAllStreamsOffline();
  await subscribeAllChannelUpdates();
  const after = (await getEventSubList()).length;
  log.warn("EventSub reloaded via web admin", { admin_id: adminId, before: subs.length, after });
  return { before: subs.length, after };
}

export async function disconnectEventSub(adminId: number): Promise<{ deleted: number }> {
  const subs = await getEventSubList();
  await deleteSubs(subs);
  log.warn("EventSub disconnected via web admin", { admin_id: adminId, deleted: subs.length });
  return { deleted: subs.length };
}

/** Removes subscriptions whose channel no longer has any follower. */
export async function cleanupEventSub(adminId: number): Promise<{ total: number; removed: number; remaining: number }> {
  const subs = await getEventSubList();
  const orphaned = [];
  for (const sub of subs) {
    const channelId = sub.condition.broadcaster_user_id;
    if (!channelId) continue;
    const follows = await getChannelFollowersByChannelIdAndPlatform(Number(channelId), "twitch");
    if (follows.length === 0) orphaned.push(sub);
  }
  await deleteSubs(orphaned);
  log.warn("EventSub cleanup via web admin", { admin_id: adminId, total: subs.length, removed: orphaned.length });
  return { total: subs.length, removed: orphaned.length, remaining: subs.length - orphaned.length };
}

export interface KickWebhookStatus {
  total: number;
  livestream: number;
}

export async function getKickWebhookStatus(): Promise<KickWebhookStatus> {
  const subs = await getKickSubscriptions();
  return {
    total: subs.length,
    livestream: subs.filter((sub) => sub.event === "livestream.status.updated").length,
  };
}

export async function reloadKickWebhook(adminId: number): Promise<{ before: number; after: number }> {
  const subs = await getKickSubscriptions();
  const dbChannels = await getChannelsWithFollowersByPlatform("kick");
  await deleteKickSubscriptions(subs);
  await new Promise((resolve) => setTimeout(resolve, RESUBSCRIBE_DELAY_MS));
  await subscribeToKickChannelsOnline(dbChannels.map((channel) => channel.channel_id!));
  const after = (await getKickSubscriptions()).length;
  log.warn("Kick webhooks reloaded via web admin", { admin_id: adminId, before: subs.length, after });
  return { before: subs.length, after };
}

export async function disconnectKickWebhook(adminId: number): Promise<{ deleted: number }> {
  const subs = await getKickSubscriptions();
  await deleteKickSubscriptions(subs);
  log.warn("Kick webhooks disconnected via web admin", { admin_id: adminId, deleted: subs.length });
  return { deleted: subs.length };
}

export async function cleanupKickWebhook(adminId: number): Promise<{ total: number; removed: number; remaining: number }> {
  const subs = await getKickSubscriptions();
  const orphaned = [];
  for (const sub of subs) {
    const follows = await getChannelFollowersByChannelIdAndPlatform(Number(sub.broadcaster_user_id), "kick");
    if (follows.length === 0) orphaned.push(sub);
  }
  await deleteKickSubscriptions(orphaned);
  log.warn("Kick webhook cleanup via web admin", { admin_id: adminId, total: subs.length, removed: orphaned.length });
  return { total: subs.length, removed: orphaned.length, remaining: subs.length - orphaned.length };
}

/** Generates a one-time admin invite key, same format as the bot flow. */
export async function createAdminKey(issuedBy: number): Promise<AdminKey> {
  const key = randomBytes(32).toString("base64url");
  log.warn("admin key created via web admin", { admin_id: issuedBy });
  return addAdminKey(issuedBy, key);
}
