import { useApi } from "./useApi";
import { useApiError } from "./useApi";

export interface FollowLive {
  status: "online" | "offline" | "unknown";
  title?: string;
  viewers?: number;
  category?: string;
  startedAt?: string;
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
  shareUrl: string | null;
  startParam: string | null;
}

export interface ChannelMatch {
  platform: "twitch" | "kick";
  channelId: string;
  login: string;
  displayName: string;
  url: string;
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
  const localizeError = useApiError();

  const items = useState<Follow[]>("follows", () => []);
  const nextCursor = useState<string | null>("follows-cursor", () => null);
  const loading = useState<boolean>("follows-loading", () => false);
  const loadingMore = useState<boolean>("follows-loading-more", () => false);
  const error = useState<string | null>("follows-error", () => null);

  async function load(options: { platform?: "twitch" | "kick"; search?: string } = {}): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get<FollowListResponse>("/follows", {
        platform: options.platform,
        search: options.search,
        limit: 20,
      });
      items.value = response.items;
      nextCursor.value = response.nextCursor;
    } catch (err) {
      error.value = localizeError(err);
    } finally {
      loading.value = false;
    }
  }

  async function loadMore(options: { platform?: "twitch" | "kick"; search?: string } = {}): Promise<void> {
    if (!nextCursor.value || loadingMore.value) return;
    loadingMore.value = true;
    try {
      const response = await api.get<FollowListResponse>("/follows", {
        platform: options.platform,
        search: options.search,
        cursor: nextCursor.value,
        limit: 20,
      });
      items.value = [...items.value, ...response.items];
      nextCursor.value = response.nextCursor;
    } catch (err) {
      error.value = localizeError(err);
    } finally {
      loadingMore.value = false;
    }
  }

  async function getDetails(platform: string, channelId: string): Promise<FollowDetails> {
    return api.get<FollowDetails>(`/follows/${platform}/${channelId}`);
  }

  async function addFollow(platform: "twitch" | "kick", channelId: string, login?: string): Promise<{ isNew: boolean; follow: Follow }> {
    return api.post<{ isNew: boolean; follow: Follow }>("/follows", { platform, channelId, login });
  }

  async function removeFollow(platform: string, channelId: string): Promise<{ removed: boolean }> {
    const result = await api.del<{ removed: boolean }>(`/follows/${platform}/${channelId}`);
    if (result.removed) {
      items.value = items.value.filter((item) => !(item.platform === platform && item.channelId === channelId));
    }
    return result;
  }

  async function resolve(query: string, platform?: "twitch" | "kick"): Promise<ResolveResponse> {
    return api.post<ResolveResponse>("/channels/resolve", { query, platform });
  }

  async function loadOnline(): Promise<Follow[]> {
    const response = await api.get<{ items: Follow[]; checkedAt: string }>("/online");
    return response.items;
  }

  return {
    items,
    nextCursor,
    loading,
    loadingMore,
    error,
    load,
    loadMore,
    getDetails,
    addFollow,
    removeFollow,
    resolve,
    loadOnline,
  };
}
