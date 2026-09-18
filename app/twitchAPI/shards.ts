import WebSocket from "ws";
import { APP_TOKEN, CLIENT_ID, CONDUIT_ID, TWITCH_HELIX } from "../config";
import { onNotification, onSessionWelcome } from "../handlers/ws_handler";
import logger from "../logger";
import { isDuplicateEventMessage } from "./message_dedup";

const log = logger.getSubLogger({ name: "twitchAPI:shards" });

const SHARD_URL: string = TWITCH_HELIX + "/helix/eventsub/conduits/shards";
let ws: WebSocket | undefined;
let baseUrl: string;
let reconnectingFrom: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

export async function updateShard(sessionId: string,shardId: number): Promise<void> {
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
          id: shardId,
          transport: {
            method: "websocket",
            session_id: sessionId,
          },
        },
      ],
    }),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    console.error("Error shard update: ", data);
    throw new Error("Update shard failed");
  }
  console.log(`Shard updated successfully. Session ID: `, sessionId);
}

function scheduleReconnect(previousWs?: WebSocket): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    connect(baseUrl, previousWs, true).catch((error) => {
      console.error("WebSocket reconnect failed:", error);
      scheduleReconnect(previousWs);
    });
  }, 5000);
}

export function connectWebSocket(url: string): Promise<void> {
  baseUrl = url;
  return connect(url, undefined, true);
}

function connect(
  url: string,
  previousWs?: WebSocket,
  shouldUpdateShard = false,
): Promise<void> {
  console.log("Connecting to EventSub...");
  const socket = new WebSocket(url);

  return new Promise((resolve, reject) => {
    let welcomed = false;

    socket.on("open", () => {
      console.log(
        "WebSocket connected to EventSub, waiting for session_welcome...",
      );
    });

    socket.on("message", async (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        const type = msg.metadata?.message_type;

        switch (type) {
          case "session_welcome": {
            welcomed = true;
            ws = socket;
            reconnectingFrom = undefined;

            // Twitch keeps the old connection alive until this Welcome arrives.
            // A reconnect URL already transfers the conduit shard automatically.
            if (shouldUpdateShard) {
              await onSessionWelcome(msg.payload.session.id);
            }
            if (previousWs && previousWs !== socket) previousWs.close();
            resolve();
            break;
          }
          case "session_keepalive":
            break;
          case "session_reconnect": {
            if (socket !== ws || reconnectingFrom === socket) break;

            console.warn("Twitch required reconnect");
            const reconnectUrl = msg.payload.session.reconnect_url;
            reconnectingFrom = socket;
            connect(reconnectUrl, socket).catch((error) => {
              console.error("WebSocket reconnect failed:", error);
              if (!ws || ws === socket) {
                reconnectingFrom = undefined;
                // A reconnect URL becomes invalid after an unsuccessful attempt.
                scheduleReconnect(socket);
              }
            });
            break;
          }
          case "notification":
            if (isDuplicateEventMessage(msg.metadata?.message_id)) {
              log.warn("duplicate notification skipped", {
                message_id: msg.metadata?.message_id,
                subscription_type: msg.payload?.subscription?.type,
              });
              break;
            }
            await onNotification(msg.payload);
            break;
          case "revocation":
            console.warn("Subscription revoked: ", msg.payload?.subscription?.type);
        }
      } catch (error) {
        console.error("WebSocket message handling failed:", error);
        if (!welcomed) {
          socket.close();
          reject(error);
        }
      }
    });

    socket.on("close", (code: any) => {
      if (!welcomed) {
        reject(new Error(`WebSocket closed before welcome (code ${code})`));
      }
      if (socket !== ws) return;

      ws = undefined;
      if (reconnectingFrom === socket) return;

      console.warn(`❌ WebSocket closed (code ${code}), reconnecting...`);
      if (code !== 1000) scheduleReconnect();
    });

    socket.on("error", (error: any) => {
      console.error("WebSocket error:", error.message);
      if (!welcomed) reject(error);
    });
  });
}
