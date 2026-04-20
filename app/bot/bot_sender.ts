import { getChannelFollowers } from "../database/db";
import { botInstance as bot } from "./bot";

export async function sendStreamOnlineNotificationToUsers(
  channel_id: number,
  channel_name: string,
  data: JSON,
) {
  const followers = getChannelFollowers.all(channel_id);
  for (const follower of followers) {
    await bot.api.sendMessage(
      follower.user_id,
      //@ts-ignore
      `${channel_name} ведет прямую трансляцию.\n${data.title}\nКатегория: ${data.game_name}\n\ntwitch.tv/${channel_name}`,
    );
  }
}

export async function sendStreamOfflineNotificationToUsers(
  channel_id: number,
  channel_name: string,
) {
  const followers = getChannelFollowers.all(channel_id);
  for (const follower of followers) {
    await bot.api.sendMessage(
      follower.user_id,
      `${channel_name} завершил прямую трансляцию.`,
    );
  }
}
