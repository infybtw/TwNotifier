import { getChannelFollowers } from "../database/db";
import { botInstance as bot } from "./bot";

export async function sendStreamNotificationToUsers(
  channel_id: number,
  channel_name: string,
) {
  const followers = getChannelFollowers.all(channel_id);
  for (const follower of followers) {
    await bot.api.sendMessage(
      follower.user_id,
      `${channel_name} сейчас онлайн.`,
    );
  }
}
