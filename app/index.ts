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


async function main(): Promise<void> {
  await migrateDB()
  await botStart();
  await getAppToken();
  await getKickAppToken();
  await createConduit(SHARD_COUNT);
  await connectWebSocket(TWITCH_WS);
  startHTTPServer()
  console.log("Kick subs: " + (await getKickSubscriptions()).length)
  console.log("Twitch subs: " + ((await getEventSubList()).length) )
}

main().catch(console.error);
