import {
  sendTwitchStreamCategoryChangedNotificationToUsers,
  sendTwitchStreamOfflineNotificationToUsers,
  sendTwitchStreamOnlineNotificationToUsers,
  sendTwitchStreamTitleChangedNotificationToUsers,
} from "../bot/bot_sender";
import { finishTwitchStream, startTwitchStream, startTwitchStreamAt, updateTwitchStream } from "../database/db";
import logger from "../logger";
import { updateShard } from "../twitchAPI/shards";
import { getChannelInfo, getStreamsByUserIds } from "../twitchAPI/users";

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
       const newTitle = event.title ?? "";
       const newCategory = event.category_name ?? "Без категории";
       const changes = await updateTwitchStream(channelId, newTitle, newCategory);
       let titleChanged = changes.titleChanged;
       let categoryChanged = changes.categoryChanged;

       if (!changes.hadActiveSession) {
         // Сессия не записана (например, бот перезапущен во время стрима).
         // Если канал реально в эфире — восстанавливаем сессию с started_at от Twitch.
         const [live] = await getStreamsByUserIds([channelId]);
         if (live) {
           await startTwitchStreamAt(channelId, newTitle, newCategory, live.started_at);
           titleChanged = true;
           categoryChanged = true;
         }
       } else if (titleChanged || categoryChanged) {
         // Если канал на самом деле офлайн — закрываем зависшую сессию без уведомлений.
         const [live] = await getStreamsByUserIds([channelId]);
         if (!live) {
           await finishTwitchStream(channelId);
           titleChanged = false;
           categoryChanged = false;
         }
       }

       if (titleChanged) {
         await sendTwitchStreamTitleChangedNotificationToUsers(channelId, event.broadcaster_user_name, newTitle);
       }
       if (categoryChanged) {
         await sendTwitchStreamCategoryChangedNotificationToUsers(channelId, event.broadcaster_user_name, newCategory);
       }
       break;
    }
    default:
      break;
  }
}
