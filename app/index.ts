import { HTTP_SERVER_PORT, SHARD_COUNT, TWITCH_WS } from "./config";
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
  await migrateDB();
  await withRetry("botStart", () => botStart());
  await withRetry("getAppToken", () => getAppToken());
  await withRetry("getKickAppToken", () => getKickAppToken());
  await withRetry("createConduit", () => createConduit(SHARD_COUNT));
  await withRetry("connectWebSocket", () => connectWebSocket(TWITCH_WS));
  await withRetry("startHTTPServer", () => startHTTPServer());
  console.log("Kick subs: " + (await getKickSubscriptions()).length);
  console.log("Twitch subs: " + ((await getEventSubList()).length));
}

main().catch(console.error);
