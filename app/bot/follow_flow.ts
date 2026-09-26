import { InlineKeyboard } from "grammy";
import { t, type Locale } from "../i18n";
import { channelUrl, type Platform } from "../services/types";
import type { ResolvedChannel } from "../services/channels";
import { buildAddConfirmationKeyboard, buildRemoveConfirmationKeyboard } from "./keyboards";

export type PendingChannel = ResolvedChannel;

export function buildAddPreview(
  channel: PendingChannel,
  locale: Locale,
  opts: { withPlatform?: boolean } = {},
): { text: string; keyboard: InlineKeyboard } {
  const url = channelUrl(channel.platform, channel.login);
  const keyboard = buildAddConfirmationKeyboard(locale);
  if (opts.withPlatform) {
    return {
      text: t("add.preview_platform", locale)
        .replace("{name}", channel.displayName)
        .replace("{platform}", t(`platform.${channel.platform}`, locale))
        .replace("{url}", url),
      keyboard,
    };
  }
  return {
    text: t("add.preview", locale)
      .replace("{name}", channel.displayName)
      .replace("{url}", url),
    keyboard,
  };
}

export function buildRemovePreview(
  channel: PendingChannel,
  locale: Locale,
): { text: string; keyboard: InlineKeyboard } {
  return {
    text: t("remove.preview", locale)
      .replace("{name}", channel.displayName)
      .replace("{url}", channelUrl(channel.platform, channel.login)),
    keyboard: buildRemoveConfirmationKeyboard(locale),
  };
}

export function buildDualPlatformMessage(login: string, locale: Locale): string {
  return t("add.dual_platform", locale)
    .replace("{kickUrl}", `https://kick.com/${login}`)
    .replace("{twitchUrl}", `https://twitch.tv/${login}`);
}

export function buildDualPlatformRemoveMessage(login: string, locale: Locale): string {
  return t("remove.dual_platform", locale)
    .replace("{kickUrl}", `https://kick.com/${login}`)
    .replace("{twitchUrl}", `https://twitch.tv/${login}`);
}

export function findPendingChannel(channels: PendingChannel[] | undefined, platform: Platform): PendingChannel | undefined {
  return channels?.find((channel) => channel.platform === platform);
}

export function channelToPending(channel: {
  platform: Platform;
  channel_id: number;
  channel_login: string;
  channel_name: string;
}): PendingChannel {
  return {
    platform: channel.platform,
    channelId: channel.channel_id,
    login: channel.channel_login,
    displayName: channel.channel_name,
    // Remove flow does not have avatar data; it is only used in add previews.
    avatarUrl: null,
  };
}
