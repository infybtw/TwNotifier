import { TWITCH_WEBHOOK_SECRET } from "../config";
import { onNotification } from "../handlers/ws_handler";
import logger from "../logger";
import { verifyTwitchWebhook } from "./verifyWebhook";

const log = logger.getSubLogger({ name: "twitchAPI:webhook_handler" });

interface HandleTwitchWebhookParams {
  rawBody: string;
  headers: Headers;
}

interface HandleTwitchWebhookResult {
  status: number;
  body: string;
}

export async function handleTwitchWebhook({
  rawBody,
  headers,
}: HandleTwitchWebhookParams): Promise<HandleTwitchWebhookResult> {
  const messageId = headers.get("twitch-eventsub-message-id");
  const timestamp = headers.get("twitch-eventsub-message-timestamp");
  const signature = headers.get("twitch-eventsub-message-signature");
  const messageType = headers.get("twitch-eventsub-message-type");

  if (!messageId || !timestamp || !signature || !messageType) {
    return { status: 400, body: "Missing required Twitch headers" };
  }

  const isValid = verifyTwitchWebhook(
    { messageId, timestamp, signature },
    rawBody,
    TWITCH_WEBHOOK_SECRET,
  );

  if (!isValid) {
    log.warn("Invalid Twitch webhook signature", { messageId });
    return { status: 403, body: "Invalid signature" };
  }

  switch (messageType) {
    case "webhook_callback_verification": {
      const payload = JSON.parse(rawBody);
      log.info("Twitch webhook callback verification", {
        subscriptionType: payload.subscription?.type,
      });
      return { status: 200, body: payload.challenge };
    }

    case "notification": {
      const payload = JSON.parse(rawBody);
      log.info("Twitch webhook notification", {
        subscriptionType: payload.subscription?.type,
      });
      await onNotification(payload);
      return { status: 200, body: "" };
    }

    case "revocation": {
      const payload = JSON.parse(rawBody);
      log.warn("Twitch subscription revoked", {
        subscriptionType: payload.subscription?.type,
        status: payload.subscription?.status,
      });
      return { status: 200, body: "" };
    }

    default:
      log.warn("Unknown Twitch webhook message type", { messageType });
      return { status: 200, body: "" };
  }
}
