import { useApi } from "./useApi";
import type { PageRequest } from "./usePagination";

export interface FollowLive {
  status: "online" | "offline" | "unknown";
  title?: string;
  viewers?: number;
  category?: string;
  startedAt?: string;
  /** Stream frame image, available while the channel is live. */
  previewUrl?: string;
  checkedAt: string;
}

export interface Follow {
  platform: "twitch" | "kick";
  channelId: string;
  login: string;
  displayName: string;
  url: string;
  followDate: string;
  capabilities: { titleChange: boolean; categoryChange: boolean };
  online: "online" | "offline" | "unknown";
  live?: FollowLive;
}

export interface FollowDetails extends Follow {
  avatarUrl: string | null;
  shareUrl: string | null;
  startParam: string | null;
}

export interface ChannelMatch {
  platform: "twitch" | "kick";
  channelId: string;
  login: string;
  displayName: string;
  url: string;
  avatarUrl: string | null;
  alreadyFollowing: boolean;
  capabilities: { titleChange: boolean; categoryChange: boolean };
}

export interface ResolveResponse {
  username: string;
  platformHint: "twitch" | "kick" | null;
  unavailablePlatforms: ("twitch" | "kick")[];
  matches: ChannelMatch[];
}

interface FollowListResponse {
  items: Follow[];
  nextCursor: string | null;
}

export function useFollows() {
  const api = useApi();
  async function getPage(options: PageRequest & { platform?: "twitch" | "kick"; search?: string }): Promise<FollowListResponse> {
    return api.get<FollowListResponse>("/follows", { ...options });
  }

  async function getDetails(platform: string, channelId: string): Promise<FollowDetails> {
    return api.get<FollowDetails>(`/follows/${platform}/${channelId}`);
  }

  async function addFollow(platform: "twitch" | "kick", channelId: string, login?: string): Promise<{ isNew: boolean; follow: Follow }> {
    return api.post<{ isNew: boolean; follow: Follow }>("/follows", { platform, channelId, login });
  }

  async function removeFollow(platform: string, channelId: string): Promise<{ removed: boolean }> {
    return api.del<{ removed: boolean }>(`/follows/${platform}/${channelId}`);
  }

  async function resolve(query: string, platform?: "twitch" | "kick"): Promise<ResolveResponse> {
    return api.post<ResolveResponse>("/channels/resolve", { query, platform });
  }

  async function loadOnline(): Promise<Follow[]> {
    const response = await api.get<{ items: Follow[]; checkedAt: string }>("/online");
    return response.items;
  }

  return {
    getPage,
    getDetails,
    addFollow,
    removeFollow,
    resolve,
    loadOnline,
  };
}
