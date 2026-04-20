import WebSocket from "ws";
import fetch from "node-fetch";
import { APP_TOKEN, CLIENT_ID, CONDUIT_ID } from "../config";
import { onNotification, onSessionWelcome } from "../handlers/ws_handler";
import { subscribeAllStreams, subscribeToChannelOnline } from "./subscriptions";

const SHARD_URL: string =
  "https://api.twitch.tv/helix/eventsub/conduits/shards";
let ws: WebSocket;

export async function updateShard(
  sessionId: string,
  shardId: string,
): Promise<void> {
  const res = await fetch(SHARD_URL, {
    method: "PATCH",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${APP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conduit_id: CONDUIT_ID,
      shards: [
        {
          id: `${shardId}`,
          transport: {
            method: "websocket",
            session_id: sessionId,
          },
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Error shard update: ", data);
    throw new Error("Update shard failed");
  }

  console.log(`Shard updated successfully. Session ID: `, sessionId);
}

export async function connectWebSocket(url: string) {
  console.log("Connecting to EventSub...");
  ws = new WebSocket(url);

  ws.on("open", () => {
    console.log(
      "WebSocket connected to EventSub, waiting for session_welcome...",
    );
  });

  ws.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());
    const type = msg.metadata?.message_type;

    switch (type) {
      case "session_welcome":
        await onSessionWelcome(msg.payload.session.id);
        await subscribeAllStreams();
        break;
      case "session_keepalive":
        break;
      case "session_reconnect": {
        console.warn("Twitch required reconnect");
        const reconnectUrl = msg.payload.session.reconnect_url;
        await connectWebSocket(reconnectUrl);
        break;
      }
      case "notification":
        await onNotification(msg.payload);
        break;
      case "revocation":
        console.warn("Subscription revoked: ", msg.payload?.subscription?.type);
    }
  });

  ws.on("close", (code) => {
    console.warn(`❌ WebSocket closed (code ${code}), reconnecting...`);
    if (code !== 1000) setTimeout(connectWebSocket, 5000);
  });

  ws.on("error", (e) => console.error("WebSocket error:", e.message));
}
