export type Platform = "twitch" | "kick";

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
  capabilities: Record<Platform, ApiCapabilities>;
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
  platform: Platform;
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
  platform: Platform;
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
  platformHint: Platform | null;
  unavailablePlatforms: Platform[];
  matches: ChannelMatch[];
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  isNew: boolean;
  profile: Profile;
  settings: Settings;
}
