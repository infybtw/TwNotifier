import { SHARD_COUNT, TWITCH_WS } from "./config";
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


async function main(): Promise<void> {
  await migrateDB()
  await botStart();
  await getAppToken();
  await getKickAppToken();
  await createConduit(SHARD_COUNT);
  await connectWebSocket(TWITCH_WS);
  startHTTPServer(3000)
}

main().catch(console.error);
