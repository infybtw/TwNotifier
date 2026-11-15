import { api } from "./api";
import type { PageRequest } from "./pagination";
import type {
  ChannelMatch,
  Follow,
  FollowDetails,
  Platform,
  ResolveResponse,
} from "./types";

export interface FollowListResponse {
  items: Follow[];
  nextCursor: string | null;
}

export function getFollowPage(
  options: PageRequest & { platform?: Platform; search?: string },
): Promise<FollowListResponse> {
  return api.get<FollowListResponse>("/follows", { ...options });
}

export function getFollowDetails(platform: string, channelId: string): Promise<FollowDetails> {
  return api.get<FollowDetails>(`/follows/${encodeURIComponent(platform)}/${encodeURIComponent(channelId)}`);
}

export function addFollow(
  platform: Platform,
  channelId: string,
  login?: string,
): Promise<{ isNew: boolean; follow: Follow }> {
  return api.post<{ isNew: boolean; follow: Follow }>("/follows", { platform, channelId, login });
}

export function removeFollow(platform: string, channelId: string): Promise<{ removed: boolean }> {
  return api.del<{ removed: boolean }>(`/follows/${encodeURIComponent(platform)}/${encodeURIComponent(channelId)}`);
}

export function resolveChannels(query: string, platform?: Platform): Promise<ResolveResponse> {
  return api.post<ResolveResponse>("/channels/resolve", { query, platform });
}

export async function loadOnline(): Promise<{ items: Follow[]; checkedAt: string }> {
  return api.get<{ items: Follow[]; checkedAt: string }>("/online");
}

export type { ChannelMatch, Follow, FollowDetails, Platform, ResolveResponse };
