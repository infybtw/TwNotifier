import {
  sendTwitchStreamCategoryChangedNotificationToUsers,
  sendTwitchStreamOfflineNotificationToUsers,
  sendTwitchStreamOnlineNotificationToUsers,
  sendTwitchStreamTitleChangedNotificationToUsers,
} from "../bot/bot_sender";
import { backfillTwitchStream, finishTwitchStream, startTwitchStream, updateTwitchStream } from "../database/db";
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
      // Уведомление отправляется только когда сессия реально новая:
      // duplicate/adopted/outdated означают, что стрим уже был учтён
      const sessionState = await startTwitchStream(
        Number(payload.event.broadcaster_user_id),
        String(payload.event.id),
        streamData?.title ?? "",
        streamData?.game_name ?? "Без категории",
        payload.event.started_at ?? new Date().toISOString(),
      );
      if (sessionState === "created" || sessionState === "replaced") {
        await sendTwitchStreamOnlineNotificationToUsers(
          Number(payload.event.broadcaster_user_id),
          payload.event.broadcaster_user_name,
          streamData,
        );
      }
      break;
    case "stream.offline":
      log.info("stream offline", { payload: payload });
       // Сверяем id стрима из события с активной сессией: запоздавший offline
       // предыдущего стрима не должен закрыть текущий
       const result = await finishTwitchStream(
         Number(payload.event.broadcaster_user_id),
         payload.event.id ? String(payload.event.id) : undefined,
       );
       if (result.outcome === "stream_mismatch") break;
       if (result.outcome === "no_session") {
         // Стрим не был учтён (например, бот перезапущен во время стрима и
         // channel.update не приходил) — уведомляем без метаданных
         log.info("no active stream session for offline, sending plain notification", {
           channel_id: payload.event.broadcaster_user_id,
         });
       }
       await sendTwitchStreamOfflineNotificationToUsers(
         Number(payload.event.broadcaster_user_id),
         payload.event.broadcaster_user_name,
         result.outcome === "closed" ? result.summary : undefined,
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
         // Восстанавливаем сессию, но БЕЗ уведомлений: channel.update приходит
         // не только при смене названия/категории (но и языка, content
         // classification), а без baseline определить, что именно изменилось,
         // невозможно.
         const [live] = await getStreamsByUserIds([channelId]);
         if (live) {
           await backfillTwitchStream(channelId, String(live.id), newTitle, newCategory, live.started_at);
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
