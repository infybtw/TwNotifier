import { sendKickStreamfflineNotificationToUsers, sendKickStreamOnlineNotificationToUsers } from "../bot/bot_sender";
import { getKickPublicKey } from "../kickAPI/publicKey";
import { verifyKickWebhook } from "../kickAPI/verifyWebhook";
import { ALLOW_KICK_INSECURE } from "../config";
import logger from "../logger";

const log = logger.getSubLogger({name: "handlers:webhook_handler"})

interface HandleKickWebhookParams {
  rawBody: string;
  headers: Headers;
}

interface HandleKickWebhookResult {
  status: number;
  body: { ok: true } | { error: string };
}

interface KickWebhookPayload {
  broadcaster: {
    is_anonymous: boolean,
    user_id: number,
    username: string,
    is_verified: boolean,
    profile_picture: string,
    channel_slug: string,
    identity: null
  },
  is_live: boolean,
  title: string,
  started_at: string,
  ended_at: string
}

export async function handleKickWebhook({rawBody,headers}: HandleKickWebhookParams): Promise<HandleKickWebhookResult> {
  const messageId = headers.get("kick-event-message-id");
  const timestamp = headers.get("kick-event-message-timestamp");
  const signature = headers.get("kick-event-signature");
  const eventType = headers.get("kick-event-type");

  if (ALLOW_KICK_INSECURE) {
    log.warn("Kick signature validation bypassed (ALLOW_KICK_INSECURE=true)")
    console.log(rawBody)
    console.log(headers)
  } else {
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
  }

  if (!eventType) {
    return { status: 400, body: { error: "Missing kick-event-type header" } };
  }

  const payload: KickWebhookPayload = JSON.parse(rawBody);
  await processKickEvent(eventType, payload);

  return { status: 200, body: { ok: true } };
}

async function processKickEvent(eventType: string, payload: KickWebhookPayload) {
  switch (eventType) {
    case "livestream.status.updated":
      log.info("webhook recieved", {
        payload
      })
      switch (payload.is_live) {
        case true:
          await sendKickStreamOnlineNotificationToUsers(payload.broadcaster.user_id, payload.broadcaster.channel_slug, payload.title)
          break
        case false:
          await sendKickStreamfflineNotificationToUsers(payload.broadcaster.user_id, payload.broadcaster.channel_slug)
          break
        default:
          break
      }
      break;
    default:
      console.warn(`Unhandled Kick event type: ${eventType}`);
  }
}
