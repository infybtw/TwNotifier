import "dotenv/config";

import { SHARD_COUNT } from "./config";
import { getAppToken } from "./twitchAPI/auth";
import { connectWebSocket } from "./twitchAPI/shards";
import {
  deleteAllConduits,
  getConduits,
  createConduit,
} from "./twitchAPI/conduits";
import { botStart } from "./bot/bot";

// let ws        = null;

async function main(): Promise<void> {
  await botStart();
  await getAppToken();
  const conduitList = await getConduits();
  if (conduitList) {
    await deleteAllConduits(conduitList);
  }
  await createConduit(SHARD_COUNT);
  await connectWebSocket("wss://eventsub.wss.twitch.tv/ws");
}

main().catch(console.error);
