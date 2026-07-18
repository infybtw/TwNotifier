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
import { getKickAppToken } from "./kickAPI/auth";
import { startHTTPServer } from "./handlers/http_handler";
import { getKickSubscriptions } from "./kickAPI/subscription";
import { getEventSubList } from "./twitchAPI/subscriptions";
import { notifyAdminsAndExit } from "./bot/bot_sender";
import logger from "./logger";

const log = logger.getSubLogger({ name: "startup" });

async function withRetry<T>(stepName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (firstError) {
    log.warn(`Step "${stepName}" failed, retrying...`, { error: firstError });
    try {
      return await fn();
    } catch (secondError) {
      await notifyAdminsAndExit(stepName, secondError);
    }
  }
}

async function main(): Promise<void> {
  if (TWITCH_EVENT_TRANSPORT !== "webhook" && TWITCH_EVENT_TRANSPORT !== "conduit") {
    log.error("TWITCH_EVENT_TRANSPORT must be 'webhook' or 'conduit'", { value: TWITCH_EVENT_TRANSPORT });
    process.exit(1);
  }

  if (TWITCH_EVENT_TRANSPORT === "webhook") {
    if (!TWITCH_WEBHOOK_PATH) {
      log.error("TWITCH_WEBHOOK_PATH is required when TWITCH_EVENT_TRANSPORT=webhook");
      process.exit(1);
    }
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
  await withRetry("botStart", () => botStart());
  await withRetry("getAppToken", () => getAppToken());
  await withRetry("getKickAppToken", () => getKickAppToken());

  if (TWITCH_EVENT_TRANSPORT === "conduit") {
    await withRetry("createConduit", () => createConduit(SHARD_COUNT));
    await withRetry("connectWebSocket", () => connectWebSocket(TWITCH_WS));
  }

  await withRetry("startHTTPServer", () => startHTTPServer());
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
