import {
  sendTwitchStreamOfflineNotificationToUsers,
  sendTwitchStreamOnlineNotificationToUsers,
} from "../bot/bot_sender";
import logger from "../logger";
import { updateShard } from "../twitchAPI/shards";
import { getChannelInfo } from "../twitchAPI/users";

export async function onSessionWelcome(sessionId: any) {
  console.log("Session ID: ", sessionId);
  await updateShard(sessionId, 0);
}

const log = logger.getSubLogger({ name: "handlers:ws_handler" });

export async function onNotification(payload: any) {
  const type: string = payload.subscription.type;
  const event = payload.event;
  switch (type) {
    case "stream.online":
      log.info("stream online", { payload: payload });
      const streamData = await getChannelInfo(
        payload.event.broadcaster_user_id,
      );
      sendTwitchStreamOnlineNotificationToUsers(
        Number(payload.event.broadcaster_user_id),
        payload.event.broadcaster_user_name,
        streamData,
      );
      break;
    case "stream.offline":
      log.info("stream offline", { payload: payload });
      sendTwitchStreamOfflineNotificationToUsers(
        Number(payload.event.broadcaster_user_id),
        payload.event.broadcaster_user_name,
      );
      break;
    default:
      break;
  }
}
