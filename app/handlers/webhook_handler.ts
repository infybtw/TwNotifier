import { sendKickStreamfflineNotificationToUsers, sendKickStreamOnlineNotificationToUsers, sendKickStreamTitleChangedNotificationToUsers, sendKickStreamCategoryChangedNotificationToUsers } from "../bot/bot_sender";
import { finishKickStream, getChannelByChannelIdAndPlatform, startKickStream, updateKickStream } from "../database/db";
import { getKickChannelByUsername } from "../kickAPI/users";
import { getKickPublicKey } from "../kickAPI/publicKey";
import { verifyKickWebhook } from "../kickAPI/verifyWebhook";
import logger from "../logger";
import { beginEventMessage, completeEventMessage, releaseEventMessage } from "../twitchAPI/message_dedup";

const log = logger.getSubLogger({name: "handlers:webhook_handler"})

interface HandleKickWebhookParams {
  rawBody: string;
  headers: Headers;
}

interface HandleKickWebhookResult {
  status: number;
  body: { ok: true } | { error: string };
}

interface KickBroadcasterPayload {
  broadcaster: {
    is_anonymous: boolean,
    user_id: number,
    username: string,
    is_verified: boolean,
    profile_picture: string,
    channel_slug: string,
    identity: null
  }
}

interface KickStatusPayload extends KickBroadcasterPayload {
  is_live: boolean,
  title: string,
  started_at: string,
  ended_at: string | null
}

interface KickMetadataPayload extends KickBroadcasterPayload {
  metadata: {
    title: string;
    language: string;
    has_mature_content: boolean;
    category: { id: number; name: string; thumbnail: string } | null;
  };
}

type KickWebhookPayload = KickStatusPayload | KickMetadataPayload;

export async function handleKickWebhook({rawBody,headers}: HandleKickWebhookParams): Promise<HandleKickWebhookResult> {
  const messageId = headers.get("kick-event-message-id");
  const timestamp = headers.get("kick-event-message-timestamp");
  const signature = headers.get("kick-event-signature");
  const eventType = headers.get("kick-event-type");

  if (!messageId || !timestamp || !signature || !eventType) {
    return { status: 400, body: { error: "Missing required Kick headers" } };
  }

  const publicKey = await getKickPublicKey();

  const isValid = verifyKickWebhook(
    { messageId, timestamp, signature },
    rawBody,
    publicKey
  );

  if (!isValid) {
    return { status: 401, body: { error: "Invalid signature" } };
  }

  if (!beginEventMessage(messageId)) {
    log.warn("duplicate Kick webhook skipped", { messageId, eventType });
    return { status: 200, body: { ok: true } };
  }

  try {
    const payload: KickWebhookPayload = JSON.parse(rawBody);
    await processKickEvent(eventType, payload);
  } catch (err) {
    // Обработка не удалась — освобождаем id, чтобы повторная доставка
    // обработалась, а не была проглочена как дубликат (ответим 500 → ретрай)
    releaseEventMessage(messageId);
    throw err;
  }
  completeEventMessage(messageId);

  return { status: 200, body: { ok: true } };
}

async function processKickEvent(eventType: string, payload: KickWebhookPayload) {
  const channelId = payload.broadcaster.user_id;
  if (!await getChannelByChannelIdAndPlatform(channelId, "kick")) {
    log.warn("ignoring Kick event for unknown channel", { eventType, channel_id: channelId });
    return;
  }
  switch (eventType) {
    case "livestream.status.updated":
      if (!("is_live" in payload)) throw new Error("Invalid Kick status payload");
      log.info("webhook recieved", {
        payload
      })
      switch (payload.is_live) {
        case true: {
          // Уведомление только когда сессия реально новая: status.updated
          // приходит и при обновлении метаданных уже идущего стрима.
          const channel = (await getKickChannelByUsername(payload.broadcaster.channel_slug)).data?.[0];
          const isNewStream = await startKickStream(
            channelId, payload.title, payload.started_at,
            channel?.stream?.is_live ? channel.category?.name ?? "Без категории" : undefined,
          )
          if (isNewStream) {
            await sendKickStreamOnlineNotificationToUsers(payload.broadcaster.user_id, payload.broadcaster.channel_slug, payload.title)
          }
          break
        }
        case false: {
          const finishResult = await finishKickStream(payload.broadcaster.user_id, payload.started_at, payload.ended_at ?? undefined)
          if (finishResult.outcome === "stream_mismatch") break
          if (finishResult.outcome === "no_session") {
            // Стрим не был учтён (например, бот перезапущен во время стрима) —
            // уведомляем без метаданных
            log.info("no active kick stream session for offline, sending plain notification", {
              channel_id: payload.broadcaster.user_id,
            })
          }
          await sendKickStreamfflineNotificationToUsers(
            payload.broadcaster.user_id,
            payload.broadcaster.channel_slug,
            finishResult.outcome === "closed" ? finishResult.durationMs : undefined,
          )
          break
        }
        default:
          break
      }
      break;
    case "livestream.metadata.updated": {
      if (!("metadata" in payload)) throw new Error("Invalid Kick metadata payload");
      log.info("kick livestream metadata updated", { payload });
      // Событие приходит и офлайн; оно само по себе не подтверждает эфир.
      const channel = (await getKickChannelByUsername(payload.broadcaster.channel_slug)).data?.[0];
      if (!channel) throw new Error("Could not fetch Kick channel for metadata update");
      if (!channel.stream?.is_live) break;
      const title = payload.metadata.title;
      const category = payload.metadata.category?.name ?? "Без категории";
      const startedAt = channel.stream.start_time;
      if (!startedAt || !Number.isFinite(new Date(startedAt).getTime())) {
        throw new Error("Missing valid Kick stream start time");
      }
      const changes = await updateKickStream(channelId, title, category, startedAt);
      if (!changes.hadActiveSession) {
        // Нет baseline (например, бот подключился во время эфира): сохраняем
        // метаданные без уведомлений и без ложного уведомления о старте.
        await startKickStream(channelId, title, startedAt, category);
        break;
      }
      if (changes.titleChanged) {
        await sendKickStreamTitleChangedNotificationToUsers(channelId, payload.broadcaster.channel_slug, title);
      }
      if (changes.categoryChanged) {
        await sendKickStreamCategoryChangedNotificationToUsers(channelId, payload.broadcaster.channel_slug, category);
      }
      break;
    }
    default:
      console.warn(`Unhandled Kick event type: ${eventType}`);
  }
}
