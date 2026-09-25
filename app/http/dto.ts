import type { Platform } from "../database/schema";
import type { LiveStatus, OnlineState } from "../services/online";
import { channelUrl, type SettingsDto } from "../services/types";

export type { SettingsDto };

export interface Capabilities {
  titleChange: boolean;
  categoryChange: boolean;
}

/** Platform capabilities surfaced to the UI so it never over-promises. */
export const PLATFORM_CAPABILITIES: Record<Platform, Capabilities> = {
  twitch: { titleChange: true, categoryChange: true },
  kick: { titleChange: false, categoryChange: false },
};

export interface LiveStatusDto {
  status: OnlineState;
  title?: string;
  viewers?: number;
  category?: string;
  startedAt?: string;
  checkedAt: string;
}

export function toLiveStatusDto(status: LiveStatus): LiveStatusDto {
  return {
    status: status.state,
    title: status.title,
    viewers: status.viewers,
    category: status.category,
    startedAt: status.startedAt,
    checkedAt: status.checkedAt,
  };
}

export interface FollowDto {
  platform: Platform;
  /** Public ids are strings. */
  channelId: string;
  login: string;
  displayName: string;
  url: string;
  followDate: string;
  capabilities: Capabilities;
  online: OnlineState;
  live?: LiveStatusDto;
}

export function toFollowDto(input: {
  platform: Platform;
  channelId: number;
  login: string;
  displayName: string;
  followDate: string;
  live?: LiveStatus;
}): FollowDto {
  return {
    platform: input.platform,
    channelId: String(input.channelId),
    login: input.login,
    displayName: input.displayName,
    url: channelUrl(input.platform, input.login),
    followDate: input.followDate,
    capabilities: PLATFORM_CAPABILITIES[input.platform],
    online: input.live?.state ?? "unknown",
    live: input.live ? toLiveStatusDto(input.live) : undefined,
  };
}

export interface UserProfileDto {
  id: string;
  username: string | null;
  firstName: string | null;
  language: "ru" | "en";
  isAdmin: boolean;
  chatDelivery: "unknown" | "enabled" | "blocked";
  isBotBlocked: boolean;
  capabilities: Record<Platform, Capabilities>;
}

export interface ChannelMatchDto {
  platform: Platform;
  channelId: string;
  login: string;
  displayName: string;
  url: string;
  /** Channel profile picture, when the provider exposes one. */
  avatarUrl: string | null;
  alreadyFollowing: boolean;
  capabilities: Capabilities;
}

export interface FollowDetailsDto extends FollowDto {
  /** Channel profile picture, fetched best-effort from the provider. */
  avatarUrl: string | null;
  /** Telegram share URL for the prefollow deep link, when available. */
  shareUrl: string | null;
  /** Value for t.me/<bot>?startapp=... prefollow links. */
  startParam: string | null;
}
