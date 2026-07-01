import { getChannelFollowersByChannelIdAndPlatform, getSettingsStateByUserId, getUsers } from "../database/db";
import logger from "../logger";
import { botInstance as bot } from "./bot";

const log = logger.getSubLogger({ name: "bot:sender" });

export async function sendTwitchStreamOnlineNotificationToUsers(channel_id: number, channel_name: string, data: JSON) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "twitch");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.online_notification === 1) {
        await bot.api.sendMessage(
          follower.user_id!,
          //@ts-ignore
          `<b>${channel_name}</b> ведет прямую трансляцию.\n${data.title}\n<i>${data.game_name}</i>\n\n<a href="https://twitch.tv/${channel_name}">Twitch</a>`,
          { parse_mode: "HTML" },
        );
        log.info("message sent", {
          user_id: follower.user_id,
          //@ts-ignore
          text: `<b>${channel_name}</b> ведет прямую трансляцию.\n${data.title}\n<i>${data.game_name}</i>\n\n<a href="https://twitch.tv/${channel_name}">Twitch</a>`,
        });
      }
    }
}

export async function sendTwitchStreamOfflineNotificationToUsers(channel_id: number,channel_name: string) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "twitch");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.offline_notification === 1) {
        await bot.api.sendMessage(
          follower.user_id!,
          `<b>${channel_name}</b> завершил прямую трансляцию.`,
          { parse_mode: "HTML" },
        );
        log.info("message sent", {
          user_id: follower.user_id,
          //@ts-ignore
          text: `<b>${channel_name}</b> завершил прямую трансляцию.`,
        });
      }
    }
}

export async function sendKickStreamOnlineNotificationToUsers(channel_id: number, channel_name: string, title: string) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "kick");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.online_notification === 1) {
        await bot.api.sendMessage(
          follower.user_id!,
          //@ts-ignore
          `<b>${channel_name}</b> ведет прямую трансляцию.\n${title}\n\n<a href="https://kick.com/${channel_name}">Kick</a>`,
          { parse_mode: "HTML" },
        );
        log.info("message sent", {
          user_id: follower.user_id,
          //@ts-ignore
          text: `<b>${channel_name}</b> ведет прямую трансляцию.\n${title}\n\n<a href="https://kick.com/${channel_name}">Kick</a>`,
        });
      }
    }
}

export async function sendKickStreamfflineNotificationToUsers(channel_id: number, channel_name: string) {
    const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, "kick");
    for (const follower of followers) {
      const userSettings = await getSettingsStateByUserId(follower.user_id!);
      if (userSettings?.offline_notification === 1) {
        await bot.api.sendMessage(
          follower.user_id!,
          //@ts-ignore
          `<b>${channel_name}</b> завершил прямую трансляцию.\n`,
          { parse_mode: "HTML" },
        );
        log.info("message sent", {
          user_id: follower.user_id,
          //@ts-ignore
          text: `<b>${channel_name}</b> завершил прямую трансляцию.\n`,
        });
      }
    }
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
