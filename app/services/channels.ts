import { getKickChannelByUsername } from "../kickAPI/users";
import { getUserByLogin, getUserById } from "../twitchAPI/users";
import type { Platform } from "../database/schema";
import { parseChannelInput } from "../utils/urlParser";
import { ServiceError } from "./errors";
import logger from "../logger";

const log = logger.getSubLogger({ name: "services:channels" });

export interface ResolvedChannel {
  platform: Platform;
  channelId: number;
  /** Canonical lower-cased login/slug used for lookups and links. */
  login: string;
  /** Human readable display name. */
  displayName: string;
}

export interface ResolveResult {
  /** Platform implied by a provider URL, or null for a bare username. */
  platformHint: Platform | null;
  username: string;
  channels: ResolvedChannel[];
  /** Platforms whose API could not be reached during resolution. */
  unavailablePlatforms: Platform[];
}

async function resolveTwitch(login: string): Promise<ResolvedChannel | null> {
  const user = await getUserByLogin(login);
  if (!user) return null;
  return {
    platform: "twitch",
    channelId: Number(user.id),
    login: user.login.toLowerCase(),
    displayName: user.display_name,
  };
}

async function resolveKick(login: string): Promise<ResolvedChannel | null> {
  const response = await getKickChannelByUsername(login);
  const channel = response.data?.[0];
  if (!channel) return null;
  return {
    platform: "kick",
    channelId: Number(channel.broadcaster_user_id),
    login: channel.slug.toLowerCase(),
    displayName: channel.slug,
  };
}

/**
 * Resolves a username or provider URL into all matching channels. A provider
 * URL narrows the search to that platform. Errors from an individual provider
 * are reported per platform instead of failing the whole lookup.
 */
export async function resolveChannelCandidates(input: string): Promise<ResolveResult | null> {
  const parsed = parseChannelInput(input);
  if (!parsed) return null;

  const platforms: Platform[] = parsed.platform
    ? [parsed.platform]
    : ["twitch", "kick"];

  const channels: ResolvedChannel[] = [];
  const unavailablePlatforms: Platform[] = [];

  await Promise.all(platforms.map(async (platform) => {
    try {
      const channel = platform === "twitch"
        ? await resolveTwitch(parsed.username)
        : await resolveKick(parsed.username);
      if (channel) channels.push(channel);
    } catch (error) {
      log.warn("channel resolution failed for provider", { platform, username: parsed.username, error });
      unavailablePlatforms.push(platform);
    }
  }));

  channels.sort((a, b) => (a.platform === b.platform ? a.channelId - b.channelId : a.platform.localeCompare(b.platform)));

  return {
    platformHint: parsed.platform,
    username: parsed.username,
    channels,
    unavailablePlatforms,
  };
}

/**
 * Server-side verification for add-follow requests. The client supplies a
 * channel id (and a login for Kick, which has no by-id lookup); the provider is
 * always consulted so a forged id cannot create a follow.
 */
export async function verifyChannelById(
  platform: Platform,
  channelIdRaw: string | number,
  loginRaw?: string | null,
): Promise<ResolvedChannel> {
  const channelId = Number(channelIdRaw);
  if (!Number.isSafeInteger(channelId) || channelId <= 0) {
    throw new ServiceError("INVALID_INPUT", "Invalid channel id");
  }

  if (platform === "twitch") {
    let user;
    try {
      user = await getUserById(channelId);
    } catch (error) {
      logger.getSubLogger({ name: "services:channels" }).warn("twitch verification failed", { error });
      throw new ServiceError("PROVIDER_UNAVAILABLE", "Twitch is unavailable");
    }
    if (!user) {
      throw new ServiceError("CHANNEL_NOT_FOUND", "Channel not found");
    }
    if (loginRaw && loginRaw.toLowerCase() !== user.login.toLowerCase()) {
      throw new ServiceError("INVALID_INPUT", "Channel id does not match the login");
    }
    return {
      platform: "twitch",
      channelId,
      login: user.login.toLowerCase(),
      displayName: user.display_name,
    };
  }

  if (!loginRaw) {
    throw new ServiceError("INVALID_INPUT", "login is required for kick channels");
  }

  let response;
  try {
    response = await getKickChannelByUsername(loginRaw);
  } catch (error) {
    logger.getSubLogger({ name: "services:channels" }).warn("kick verification failed", { error });
    throw new ServiceError("PROVIDER_UNAVAILABLE", "Kick is unavailable");
  }
  const channel = response.data?.[0];
  if (!channel || Number(channel.broadcaster_user_id) !== channelId) {
    throw new ServiceError("CHANNEL_NOT_FOUND", "Channel not found");
  }
  return {
    platform: "kick",
    channelId,
    login: channel.slug.toLowerCase(),
    displayName: channel.slug,
  };
}
