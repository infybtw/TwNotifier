import { getAdmins, getChannelFollowersByChannelIdAndPlatform, getSettingsStateByUserId, getUsers, insertStreamLog } from "../database/db";
import { t, Locale } from "../i18n";
import logger from "../logger";
import { botInstance as bot } from "./bot";

const log = logger.getSubLogger({ name: "bot:sender" });

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
      if (userSettings?.online_notification === 1) {
        const locale = (userSettings?.language as Locale) || "ru";
        const linkPreviewDisabled = userSettings?.link_preview === 0;
        //@ts-ignore
        const text = t("notifications.stream_online", locale)
          .replace("{name}", channel_name)
          //@ts-ignore
          .replace("{title}", data.title)
          //@ts-ignore
          .replace("{game}", data.game_name);
        await bot.api.sendMessage(
          follower.user_id!,
          text,
          { 
            parse_mode: "Markdown",
            link_preview_options: { is_disabled: linkPreviewDisabled }
          },
        );
        log.info("message sent", { user_id: follower.user_id, text });
      }
    }
    await insertStreamLog(channel_id, "twitch", "online")
}

export async function sendTwitchStreamOfflineNotificationToUsers(channel_id: number, channel_name: string) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "twitch");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.offline_notification === 1) {
        const locale = (userSettings?.language as Locale) || "ru";
        const linkPreviewDisabled = userSettings?.link_preview === 0;
        const text = t("notifications.stream_offline", locale).replace("{name}", channel_name);
        await bot.api.sendMessage(
          follower.user_id!,
          text,
          { 
            parse_mode: "Markdown",
            link_preview_options: { is_disabled: linkPreviewDisabled }
          },
        );
        log.info("message sent", { user_id: follower.user_id, text });
      }
    }
    await insertStreamLog(channel_id, "twitch", "offline")
}

export async function sendKickStreamOnlineNotificationToUsers(channel_id: number, channel_name: string, title: string) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "kick");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.online_notification === 1) {
        const locale = (userSettings?.language as Locale) || "ru";
        const linkPreviewDisabled = userSettings?.link_preview === 0;
        const text = t("notifications.stream_online_kick", locale)
          .replace("{name}", channel_name)
          .replace("{title}", title);
        await bot.api.sendMessage(
          follower.user_id!,
          text,
          { 
            parse_mode: "Markdown",
            link_preview_options: { is_disabled: linkPreviewDisabled }
          },
        );
        log.info("message sent", { user_id: follower.user_id, text });
      }
    }
    await insertStreamLog(channel_id, "kick", "online")
}

export async function sendKickStreamfflineNotificationToUsers(channel_id: number, channel_name: string) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "kick");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.offline_notification === 1) {
        const locale = (userSettings?.language as Locale) || "ru";
        const linkPreviewDisabled = userSettings?.link_preview === 0;
        const text = t("notifications.stream_offline", locale).replace("{name}", channel_name);
        await bot.api.sendMessage(
          follower.user_id!,
          text,
          { 
            parse_mode: "Markdown",
            link_preview_options: { is_disabled: linkPreviewDisabled }
          },
        );
        log.info("message sent", { user_id: follower.user_id, text });
      }
    }
    await insertStreamLog(channel_id, "kick", "offline")
}

export async function sendBroadcastMessage(
  messageText: string | undefined,
  photoFileId: string | undefined,
): Promise<{ sent: number; failed: number }> {
  const users = await getUsers();
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
      log.error("broadcast send failed", { user_id: user.user_id, error: err });
    }
  }
  log.info("broadcast finished", { sent, failed, total: users.length });
  return { sent, failed };
}
