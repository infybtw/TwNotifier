import {
  sendTwitchStreamCategoryChangedNotificationToUsers,
  sendTwitchStreamOfflineNotificationToUsers,
  sendTwitchStreamOnlineNotificationToUsers,
  sendTwitchStreamTitleChangedNotificationToUsers,
} from "../bot/bot_sender";
import { finishTwitchStream, startTwitchStream, updateTwitchStream } from "../database/db";
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
       await startTwitchStream(
         Number(payload.event.broadcaster_user_id),
         streamData?.title ?? "",
         streamData?.game_name ?? "Без категории",
       );
       await sendTwitchStreamOnlineNotificationToUsers(
        Number(payload.event.broadcaster_user_id),
        payload.event.broadcaster_user_name,
        streamData,
      );
      break;
    case "stream.offline":
      log.info("stream offline", { payload: payload });
       const summary = await finishTwitchStream(Number(payload.event.broadcaster_user_id));
       await sendTwitchStreamOfflineNotificationToUsers(
         Number(payload.event.broadcaster_user_id),
         payload.event.broadcaster_user_name,
         summary,
       );
       break;
    case "channel.update": {
       log.info("channel updated", { payload });
       const channelId = Number(event.broadcaster_user_id);
       const changes = await updateTwitchStream(channelId, event.title ?? "", event.category_name ?? "Без категории");
       if (changes.titleChanged) {
         await sendTwitchStreamTitleChangedNotificationToUsers(channelId, event.broadcaster_user_name, event.title ?? "");
       }
       if (changes.categoryChanged) {
         await sendTwitchStreamCategoryChangedNotificationToUsers(channelId, event.broadcaster_user_name, event.category_name ?? "Без категории");
       }
       break;
    }
    default:
      break;
  }
}
