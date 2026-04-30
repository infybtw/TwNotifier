import { SHARD_COUNT, TWITCH_WS } from "./config";
import { getAppToken } from "./twitchAPI/auth";
import { connectWebSocket } from "./twitchAPI/shards";
import {
  deleteAllConduits,
  getConduits,
  createConduit,
} from "./twitchAPI/conduits";
import { botStart } from "./bot/bot";
import { prepareDB } from "./database/db";

// let ws        = null;

async function main(): Promise<void> {
  await botStart();
  await prepareDB();
  await getAppToken();
  const conduitList = await getConduits();
  if (conduitList) {
    await deleteAllConduits(conduitList);
  }
  await createConduit(SHARD_COUNT);
  await connectWebSocket(TWITCH_WS);
}

main().catch(console.error);
