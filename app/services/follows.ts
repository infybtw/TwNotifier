import {
  checkOrCreateChannel,
  checkOrCreateFollow,
  getChannelByChannelIdAndPlatform,
  getFollowByUserIdChannelIdAndPlatform,
  removeFollowByUserIdChannelIdAndPlatfrom,
} from "../database/db";
import type { Channel, Platform, UserFollow } from "../database/schema";
import { subscribeToChannelOffline, subscribeToChannelOnline, subscribeToChannelUpdate } from "../twitchAPI/subscriptions";
import { subscribeToKickChannelOnline } from "../kickAPI/subscription";
import { ServiceError } from "./errors";
import { channelUrl } from "./types";
import type { ResolvedChannel } from "./channels";
import logger from "../logger";

const log = logger.getSubLogger({ name: "services:follows" });

export interface AddFollowResult {
  follow: UserFollow;
  channel: ResolvedChannel;
  isNew: boolean;
}

export interface RemoveFollowResult {
  removed: boolean;
}

function assertChannelId(channelId: number): void {
  if (!Number.isSafeInteger(channelId) || channelId <= 0) {
    throw new ServiceError("INVALID_INPUT", "Invalid channel id");
  }
}

/**
 * Ensures the external provider subscriptions exist for a channel.
 * Re-subscribing is idempotent: "already exists" is treated as success, which
 * makes retries after partial failures safe.
 */
async function ensureSubscriptions(channel: ResolvedChannel): Promise<void> {
  if (channel.platform === "twitch") {
    const [online, offline, update] = await Promise.all([
      subscribeToChannelOnline(channel.channelId, channel.login),
      subscribeToChannelOffline(channel.channelId, channel.login),
      subscribeToChannelUpdate(channel.channelId, channel.login),
    ]);
    if (online < 0 || offline < 0 || update < 0) {
      log.error("twitch subscription failed", { channel, online, offline, update });
      throw new ServiceError("PROVIDER_UNAVAILABLE", "Twitch subscription failed", {
        platform: "twitch",
        online,
        offline,
        update,
      });
    }
    return;
  }

  const status = await subscribeToKickChannelOnline(channel.channelId);
  if (status < 0) {
    log.error("kick subscription failed", { channel, status });
    throw new ServiceError("PROVIDER_UNAVAILABLE", "Kick subscription failed", {
      platform: "kick",
      status,
    });
  }
}

/**
 * Adds a follow for a resolved channel. The channel row is created first, the
 * external subscriptions are set up outside any transaction, and the follow is
 * saved only after the subscriptions are ready. Repeated additions return the
 * existing follow without duplicate rows or external calls.
 */
export async function addFollowForUser(userId: number, channel: ResolvedChannel): Promise<AddFollowResult> {
  assertChannelId(channel.channelId);

  await checkOrCreateChannel(channel.channelId, channel.displayName, channel.login, channel.platform);

  const existing = await getFollowByUserIdChannelIdAndPlatform(userId, channel.channelId, channel.platform);
  if (existing) {
    return { follow: existing, channel, isNew: false };
  }

  await ensureSubscriptions(channel);

  const { follow, isNew } = await checkOrCreateFollow(userId, channel.channelId, channel.platform);
  return { follow, channel, isNew };
}

/** Repeated deletions are safe and return `removed: false` when absent. */
export async function removeFollowForUser(userId: number, platform: Platform, channelId: number): Promise<RemoveFollowResult> {
  assertChannelId(channelId);
  const removed = await removeFollowByUserIdChannelIdAndPlatfrom(userId, channelId, platform);
  return { removed: Boolean(removed) };
}

export async function getFollowForUser(userId: number, platform: Platform, channelId: number): Promise<UserFollow | undefined> {
  return getFollowByUserIdChannelIdAndPlatform(userId, channelId, platform);
}

export async function getChannelForFollow(platform: Platform, channelId: number): Promise<Channel | undefined> {
  return getChannelByChannelIdAndPlatform(channelId, platform);
}

export function followUrl(channel: Pick<Channel, "platform" | "channel_login">): string {
  return channelUrl(channel.platform, channel.channel_login);
}
