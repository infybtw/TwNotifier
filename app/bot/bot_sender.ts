import { getChannelFollowers, getSettingsState } from "../database/db";
import logger from "../logger";
import { botInstance as bot } from "./bot";

const log = logger.getSubLogger({ name: "bot:sender" });

export async function sendStreamOnlineNotificationToUsers(
  channel_id: number,
  channel_name: string,
  data: JSON,
) {
  const followers = getChannelFollowers.all(channel_id);
  for (const follower of followers) {
    const userSettings = getSettingsState.get(follower.user_id);
    if (userSettings?.online_notification === 1) {
      await bot.api.sendMessage(
        follower.user_id,
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

export async function sendStreamOfflineNotificationToUsers(
  channel_id: number,
  channel_name: string,
) {
  const followers = getChannelFollowers.all(channel_id);
  for (const follower of followers) {
    const userSettings = getSettingsState.get(follower.user_id);
    if (userSettings?.offline_notification === 1) {
      await bot.api.sendMessage(
        follower.user_id,
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
