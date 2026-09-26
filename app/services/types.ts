import type { Platform, UserSettings } from "../database/schema";

export type { Platform };

export type Locale = "ru" | "en";

/** Public, boolean-based representation of user settings. */
export interface SettingsDto {
  onlineNotification: boolean;
  offlineNotification: boolean;
  titleChangeNotification: boolean;
  categoryChangeNotification: boolean;
  streamMetadata: boolean;
  linkPreview: boolean;
  language: Locale;
}

/**
 * Chat delivery permission. `unknown` means the user has not yet granted the
 * bot permission to message them; it is not the same as "blocked".
 */
export type ChatDelivery = "unknown" | "enabled" | "blocked";

export function toChatDelivery(settings: Pick<UserSettings, "chat_delivery" | "is_bot_blocked">): ChatDelivery {
  if (settings.is_bot_blocked === 1 || settings.chat_delivery === 0) return "blocked";
  if (settings.chat_delivery === 1) return "enabled";
  return "unknown";
}

export function settingsToDto(settings: UserSettings): SettingsDto {
  return {
    onlineNotification: settings.online_notification === 1,
    offlineNotification: settings.offline_notification === 1,
    titleChangeNotification: settings.title_change_notification === 1,
    categoryChangeNotification: settings.category_change_notification === 1,
    streamMetadata: settings.stream_metadata === 1,
    linkPreview: settings.link_preview === 1,
    language: (settings.language as Locale) ?? "ru",
  };
}

export function channelUrl(platform: Platform, login: string): string {
  return platform === "twitch" ? `https://twitch.tv/${login}` : `https://kick.com/${login}`;
}
