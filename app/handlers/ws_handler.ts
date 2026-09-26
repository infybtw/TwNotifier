import {
  sendTwitchStreamCategoryChangedNotificationToUsers,
  sendTwitchStreamOfflineNotificationToUsers,
  sendTwitchStreamOnlineNotificationToUsers,
  sendTwitchStreamTitleChangedNotificationToUsers,
} from "../bot/bot_sender";
import {
  backfillTwitchStream,
  finishTwitchStream,
  getChannelByChannelIdAndPlatform,
  startTwitchStream,
  updateTwitchStream,
} from "../database/db";
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
  const channelId = Number(event?.broadcaster_user_id);

  // EventSub subscriptions can outlive a channel's database record (for
  // example after a manual cleanup). Ignore them before touching stream state
  // or logs, both of which correctly reference the channel with a FK.
  if (!Number.isSafeInteger(channelId) || channelId <= 0) {
    log.warn("ignoring Twitch event with invalid broadcaster id", {
      type,
      broadcaster_id: event?.broadcaster_user_id,
    });
    return;
  }
  const channel = await getChannelByChannelIdAndPlatform(channelId, "twitch");
  if (!channel) {
    log.warn("ignoring Twitch event for unknown channel", { type, channel_id: channelId });
    return;
  }

  switch (type) {
    case "stream.online":
      log.info("stream online", { payload: payload });
      const streamData = await getChannelInfo(
        payload.event.broadcaster_user_id,
      );
      // Уведомление отправляется только когда сессия реально новая:
      // duplicate/adopted/outdated означают, что стрим уже был учтён
      const sessionState = await startTwitchStream(
        channelId,
        String(payload.event.id),
        streamData?.title ?? "",
        streamData?.game_name ?? "Без категории",
        payload.event.started_at ?? new Date().toISOString(),
      );
      if (sessionState === "created" || sessionState === "replaced") {
        await sendTwitchStreamOnlineNotificationToUsers(
          channelId,
          payload.event.broadcaster_user_name,
          streamData,
          String(payload.event.id),
        );
      }
      break;
    case "stream.offline":
      log.info("stream offline", { payload: payload });
       // Сверяем id стрима из события с активной сессией: запоздавший offline
       // предыдущего стрима не должен закрыть текущий
       const result = await finishTwitchStream(
         channelId,
         payload.event.id ? String(payload.event.id) : undefined,
       );
       if (result.outcome === "stream_mismatch") break;
       if (result.outcome === "no_session") {
         // Стрим не был учтён (например, бот перезапущен во время стрима и
         // channel.update не приходил) — уведомляем без метаданных
         log.info("no active stream session for offline, sending plain notification", {
           channel_id: channelId,
         });
       }
       await sendTwitchStreamOfflineNotificationToUsers(
         channelId,
         payload.event.broadcaster_user_name,
         result.outcome === "closed" ? result.summary : undefined,
       );
       break;
    case "channel.update": {
       log.info("channel updated", { payload });
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
