import { HTTP_SERVER_PORT, SHARD_COUNT, TWITCH_WS, TWITCH_EVENT_TRANSPORT, TWITCH_WEBHOOK_PATH, TWITCH_WEBHOOK_SECRET, BOT_URL, KICK_WEBHOOK_PATH } from "./config";
import { getAppToken } from "./twitchAPI/auth";
import { connectWebSocket } from "./twitchAPI/shards";
import {
  deleteAllConduits,
  getConduits,
  createConduit,
} from "./twitchAPI/conduits";
import { botStart } from "./bot/bot";
import { migrateDB } from "./migrate";
import { deleteExpiredWebSessions } from "./database/db";
import { getKickAppToken } from "./kickAPI/auth";
import { startHTTPServer } from "./handlers/http_handler";
import { ensureKickMetadataSubscriptions, getKickSubscriptions } from "./kickAPI/subscription";
import { ensureEventSubTransport, getEventSubList, subscribeToShardDisabled } from "./twitchAPI/subscriptions";
import { notifyAdminsAndExit } from "./bot/bot_sender";
import logger from "./logger";
import { sleep } from "bun";

const log = logger.getSubLogger({ name: "startup" });

interface RetryOptions {
  /** Extra attempts after the first failure. */
  retries?: number;
  /** Delay before every retry, in milliseconds. */
  delayMs?: number;
}

async function withRetry<T>(
  stepName: string,
  fn: () => Promise<T>,
  { retries = 1, delayMs = 0 }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) {
        return await notifyAdminsAndExit(stepName, error);
      }
      log.warn(`Step "${stepName}" failed, retrying...`, {
        error_message: error instanceof Error ? error.message : String(error),
        attempt: attempt + 1,
        retries,
      });
      await sleep(delayMs);
    }
  }
}

async function main(): Promise<void> {
  if (TWITCH_EVENT_TRANSPORT !== "webhook" && TWITCH_EVENT_TRANSPORT !== "conduit") {
    log.error("TWITCH_EVENT_TRANSPORT must be 'webhook' or 'conduit'", { value: TWITCH_EVENT_TRANSPORT });
    process.exit(1);
  }

  if (TWITCH_EVENT_TRANSPORT === "webhook") {
    if (!TWITCH_WEBHOOK_SECRET) {
      log.error("TWITCH_WEBHOOK_SECRET is required when TWITCH_EVENT_TRANSPORT=webhook");
      process.exit(1);
    }
    if (!BOT_URL) {
      log.error("BOT_URL is required when TWITCH_EVENT_TRANSPORT=webhook");
      process.exit(1);
    }
  }

  await migrateDB();
  await deleteExpiredWebSessions(new Date().toISOString());
  await withRetry("botStart", () => botStart());
  await withRetry("getAppToken", () => getAppToken());
  // Kick's token endpoint occasionally fails to resolve with ETIMEOUT on
  // startup, so give it more attempts with a delay between them.
  await withRetry("getKickAppToken", () => getKickAppToken(), { retries: 5, delayMs: 10_000 });

  if (TWITCH_EVENT_TRANSPORT === "conduit") {
    await withRetry("createConduit", () => createConduit(SHARD_COUNT));
    // EventSub handshake + shard bind can fail transiently ( DNS blip,
    // Twitch 5xx, slow welcome). Retry with backoff instead of exiting:
    // the runtime reconnect loop only starts after a first success.
    await withRetry("connectWebSocket", () => connectWebSocket(TWITCH_WS), { retries: 5, delayMs: 5_000 });
  }

  await withRetry("startHTTPServer", () => startHTTPServer());
  await withRetry("ensureEventSubTransport", () => ensureEventSubTransport());
  if (TWITCH_EVENT_TRANSPORT === "conduit") {
    // Recreate this subscription after removing any outdated transport.
    await withRetry("subscribeToShardDisabled", () => subscribeToShardDisabled());
  }
  await withRetry("ensureKickMetadataSubscriptions", () => ensureKickMetadataSubscriptions());
  console.log("Kick transport: webhook");
  console.log("Kick webhook path: " + KICK_WEBHOOK_PATH);
  console.log("Kick webhook callback URL: " + BOT_URL + KICK_WEBHOOK_PATH);
  console.log("Twitch transport: " + TWITCH_EVENT_TRANSPORT);
  if (TWITCH_EVENT_TRANSPORT === "webhook") {
    console.log("Twitch webhook path: " + TWITCH_WEBHOOK_PATH);
    console.log("Twitch webhook callback URL: " + BOT_URL + TWITCH_WEBHOOK_PATH);
  }
  console.log("Kick subs: " + (await getKickSubscriptions()).length);
  console.log("Twitch subs: " + ((await getEventSubList()).length));
}

main().catch(console.error);
