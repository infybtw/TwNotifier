import { InlineKeyboard } from "grammy";
import { getAdmins, getChannelFollowersByChannelIdAndPlatform, getSettingsStateByUserId, getUsersForNotifications, insertStreamLog, setBotBlockedStateByUserId, StreamSummary } from "../database/db";
import { t, Locale } from "../i18n";
import logger from "../logger";
import { formatDuration } from "../utils/time";
import { botInstance as bot } from "./bot";

const log = logger.getSubLogger({ name: "bot:sender" });

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isBotBlockedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const { error_code, description } = error as { error_code?: unknown; description?: unknown };
  return error_code === 403
    && typeof description === "string"
    && description.toLowerCase().includes("bot was blocked by the user");
}

async function handleSendError(userId: number, notification: string, error: unknown): Promise<void> {
  if (isBotBlockedError(error)) {
    await setBotBlockedStateByUserId(userId, 1);
    log.info("user blocked bot; notifications disabled", { user_id: userId });
    return;
  }

  log.error(`failed to send ${notification}`, { user_id: userId, error });
}

export async function notifyAdminsAndExit(stepName: string, error: unknown): Promise<never> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  log.error(`Startup failed at step: ${stepName}`, { error: errorMessage });

  try {
    const admins = await getAdmins();
    const message = `🚨 <b>Startup Failed</b>\n\nStep: <code>${stepName}</code>\nError: <code>${errorMessage}</code>\n\nBot is shutting down.`;
    for (const admin of admins) {
      try {
        await bot.api.sendMessage(admin.user_id, message, { parse_mode: "HTML" });
      } catch (sendErr) {
        log.error(`Failed to notify admin ${admin.user_id}`, { error: sendErr });
      }
    }
  } catch (dbErr) {
    log.error("Failed to fetch admins for notification", { error: dbErr });
  }

  process.exit(1);
}

export async function sendTwitchStreamOnlineNotificationToUsers(channel_id: number, channel_name: string, data: JSON) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "twitch");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.online_notification === 1 && userSettings.is_bot_blocked === 0) {
        const locale = (userSettings?.language as Locale) || "ru";
        const linkPreviewDisabled = userSettings?.link_preview === 0;
        //@ts-ignore
        const text = t("notifications.stream_online", locale)
          .replace("{name}", channel_name)
          .replace("{url}", `https://twitch.tv/${channel_name}`)
          //@ts-ignore
          .replace("{title}", data.title)
          //@ts-ignore
          .replace("{game}", data.game_name);
        const keyboard = new InlineKeyboard().url(
          t("platform.twitch", locale),
          `https://twitch.tv/${channel_name}`
        );
        try {
          await bot.api.sendMessage(
            follower.user_id!,
            text,
            {
              parse_mode: "HTML",
              link_preview_options: { is_disabled: linkPreviewDisabled },
              reply_markup: keyboard
            },
          );
          log.info("message sent", { user_id: follower.user_id, text });
        } catch (err) {
          await handleSendError(follower.user_id!, "twitch online notification", err);
        }
      }
    }
    await insertStreamLog(channel_id, "twitch", "online")
}

export async function sendTwitchStreamOfflineNotificationToUsers(channel_id: number, channel_name: string, summary?: StreamSummary) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "twitch");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.offline_notification === 1 && userSettings.is_bot_blocked === 0) {
        const locale = (userSettings?.language as Locale) || "ru";
        const linkPreviewDisabled = userSettings?.link_preview === 0;
        const text = t("notifications.stream_offline", locale)
          .replace("{name}", escapeHtml(channel_name))
          .replace("{duration}", summary ? formatDuration(summary.durationMs, locale) : "—")
          .replace("{categories}", summary ? formatCategoryHistory(summary, locale) : t("notifications.no_category_history", locale));
        try {
          await bot.api.sendMessage(
            follower.user_id!,
            text,
            {
              parse_mode: "HTML",
              link_preview_options: { is_disabled: linkPreviewDisabled }
            },
          );
          log.info("message sent", { user_id: follower.user_id, text });
        } catch (err) {
          await handleSendError(follower.user_id!, "twitch offline notification", err);
        }
      }
    }
    await insertStreamLog(channel_id, "twitch", "offline")
}

function formatCategoryHistory(summary: StreamSummary, locale: Locale): string {
  return summary.categories.map((category) => {
    const end = category.ended_at ? new Date(category.ended_at).getTime() : Date.now();
    const duration = formatDuration(end - new Date(category.started_at).getTime(), locale);
    return `• ${escapeHtml(category.category_name)} (${duration})`;
  }).join("\n");
}

async function sendTwitchStreamUpdateNotification(
  channelId: number,
  channelName: string,
  notificationKey: "notifications.stream_title_changed" | "notifications.stream_category_changed",
  value: string,
): Promise<void> {
  const followers = await getChannelFollowersByChannelIdAndPlatform(channelId, "twitch");
  for (const follower of followers) {
    const settings = await getSettingsStateByUserId(follower.user_id!);
    if (settings?.online_notification !== 1 || settings.is_bot_blocked !== 0) continue;
    const locale = (settings.language as Locale) || "ru";
    const text = t(notificationKey, locale)
      .replace("{name}", escapeHtml(channelName))
      .replace("{value}", escapeHtml(value));
    try {
      await bot.api.sendMessage(follower.user_id!, text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: settings.link_preview === 0 },
      });
    } catch (err) {
      await handleSendError(follower.user_id!, "twitch stream update notification", err);
    }
  }
}

export function sendTwitchStreamTitleChangedNotificationToUsers(channelId: number, channelName: string, title: string): Promise<void> {
  return sendTwitchStreamUpdateNotification(channelId, channelName, "notifications.stream_title_changed", title);
}

export function sendTwitchStreamCategoryChangedNotificationToUsers(channelId: number, channelName: string, category: string): Promise<void> {
  return sendTwitchStreamUpdateNotification(channelId, channelName, "notifications.stream_category_changed", category);
}

export async function sendKickStreamOnlineNotificationToUsers(channel_id: number, channel_name: string, title: string) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "kick");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.online_notification === 1 && userSettings.is_bot_blocked === 0) {
        const locale = (userSettings?.language as Locale) || "ru";
        const linkPreviewDisabled = userSettings?.link_preview === 0;
        const text = t("notifications.stream_online_kick", locale)
          .replace("{name}", channel_name)
          .replace("{url}", `https://kick.com/${channel_name}`)
          .replace("{title}", title);
        const keyboard = new InlineKeyboard().url(
          t("platform.kick", locale),
          `https://kick.com/${channel_name}`
        );
        try {
          await bot.api.sendMessage(
            follower.user_id!,
            text,
            {
              parse_mode: "HTML",
              link_preview_options: { is_disabled: linkPreviewDisabled },
              reply_markup: keyboard
            },
          );
          log.info("message sent", { user_id: follower.user_id, text });
        } catch (err) {
          await handleSendError(follower.user_id!, "kick online notification", err);
        }
      }
    }
    await insertStreamLog(channel_id, "kick", "online")
}

export async function sendKickStreamfflineNotificationToUsers(channel_id: number, channel_name: string) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "kick");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.offline_notification === 1 && userSettings.is_bot_blocked === 0) {
        const locale = (userSettings?.language as Locale) || "ru";
        const linkPreviewDisabled = userSettings?.link_preview === 0;
        const text = t("notifications.stream_offline", locale)
          .replace("{name}", escapeHtml(channel_name))
          .replace("{duration}", "—")
          .replace("{categories}", t("notifications.no_category_history", locale));
        try {
          await bot.api.sendMessage(
            follower.user_id!,
            text,
            {
              parse_mode: "HTML",
              link_preview_options: { is_disabled: linkPreviewDisabled }
            },
          );
          log.info("message sent", { user_id: follower.user_id, text });
        } catch (err) {
          await handleSendError(follower.user_id!, "kick offline notification", err);
        }
      }
    }
    await insertStreamLog(channel_id, "kick", "offline")
}

export async function sendBroadcastMessage(
  messageText: string | undefined,
  photoFileId: string | undefined,
): Promise<{ sent: number; failed: number }> {
  const users = await getUsersForNotifications();
  log.info("broadcast started", { total_users: users.length, has_photo: !!photoFileId });
  let sent = 0;
  let failed = 0;
  for (const user of users) {
    try {
      if (photoFileId) {
        await bot.api.sendPhoto(
          user.user_id,
          photoFileId,
          { caption: messageText || undefined },
        );
      } else if (messageText) {
        await bot.api.sendMessage(
          user.user_id,
          messageText,
        );
      }
      sent++;
    } catch (err) {
      failed++;
      await handleSendError(user.user_id, "broadcast", err);
    }
  }
  log.info("broadcast finished", { sent, failed, total: users.length });
  return { sent, failed };
}
