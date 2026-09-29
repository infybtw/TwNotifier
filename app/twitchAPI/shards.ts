import { sleep } from "bun";
import WebSocket from "ws";
import { APP_TOKEN, CLIENT_ID, CONDUIT_ID, TWITCH_HELIX } from "../config";
import { onNotification, onSessionWelcome } from "../handlers/ws_handler";
import logger from "../logger";
import { getAppToken } from "./auth";
import { getConduitShards } from "./conduits";
import { beginEventMessage, completeEventMessage, releaseEventMessage } from "./message_dedup";
import { resubscribeRevoked } from "./subscriptions";

const log = logger.getSubLogger({ name: "twitchAPI:shards" });

const SHARD_URL: string = TWITCH_HELIX + "/helix/eventsub/conduits/shards";
/** Events are routed to a single shard today (SHARD_COUNT=1). */
const SHARD_ID = 0;

/** Keepalive window Twitch uses unless the welcome message reports another value. */
const DEFAULT_KEEPALIVE_TIMEOUT_MS = 10_000;
/** How often the liveness watchdog inspects the last inbound message. */
const LIVENESS_CHECK_INTERVAL_MS = 5_000;
/** Extra budget on top of keepalive_timeout before the connection is deemed dead. */
const LIVENESS_GRACE_MS = 5_000;
/** Abort a connection attempt that never yields a welcome message. */
const CONNECT_TIMEOUT_MS = 15_000;
/** How often the conduit shard is compared against the live WebSocket session. */
const SHARD_HEALTHCHECK_INTERVAL_MS = 60_000;
/** Delay before a dropped connection is retried. */
const RECONNECT_DELAY_MS = 5_000;
/** updateShard attempts before giving up; each retry refreshes the app token. */
const SHARD_UPDATE_MAX_ATTEMPTS = 5;

let ws: WebSocket | undefined;
let baseUrl: string;
let reconnectingFrom: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let livenessTimer: ReturnType<typeof setInterval> | undefined;
let healthcheckTimer: ReturnType<typeof setInterval> | undefined;

/** Session id the conduit shard is currently bound to. */
let boundSessionId: string | undefined;
/** Timestamp of the last message received on the active socket. */
let lastMessageAt = 0;
/** Keepalive window reported by Twitch in the latest welcome message. */
let keepaliveTimeoutMs = DEFAULT_KEEPALIVE_TIMEOUT_MS;

/** Force-closes a socket without a close handshake (safe on half-open sockets). */
function terminate(socket: WebSocket): void {
  try {
    socket.terminate();
  } catch {
    try {
      socket.close();
    } catch {
      // Socket is already gone.
    }
  }
}

/**
 * Binds a WebSocket session to the conduit shard. Any failure (HTTP error or
 * network error) refreshes the app token and retries, because a stale token was
 * one of the ways a reconnect could silently leave the shard bound to a dead
 * session.
 */
export async function updateShard(sessionId: string, shardId: number): Promise<void> {
  for (let attempt = 1; attempt <= SHARD_UPDATE_MAX_ATTEMPTS; attempt++) {
    try {
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
      if (res.ok) {
        console.log(`Shard updated successfully. Session ID: `, sessionId);
        return;
      }
      log.warn("shard update rejected, refreshing app token", {
        shard_id: shardId,
        status: res.status,
        attempt,
        error_message: data?.message,
      });
    } catch (error) {
      log.warn("shard update request failed, refreshing app token", {
        shard_id: shardId,
        attempt,
        error,
      });
    }

    // Any failure refreshes the token before the next attempt.
    try {
      await getAppToken();
    } catch (error) {
      log.error("failed to refresh Twitch app token", { error });
    }

    if (attempt < SHARD_UPDATE_MAX_ATTEMPTS) {
      await sleep(attempt * 1_000);
    }
  }

  throw new Error(`Update shard failed after ${SHARD_UPDATE_MAX_ATTEMPTS} attempts`);
}

function scheduleReconnect(previousWs?: WebSocket): void {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    connect(baseUrl, previousWs, true).catch((error) => {
      console.error("WebSocket reconnect failed:", error);
      scheduleReconnect(previousWs);
    });
  }, RECONNECT_DELAY_MS);
}

export function connectWebSocket(url: string): Promise<void> {
  baseUrl = url;
  return connect(url, undefined, true);
}

function startLivenessWatch(socket: WebSocket): void {
  stopLivenessWatch();
  lastMessageAt = Date.now();

  livenessTimer = setInterval(() => {
    if (socket !== ws) {
      stopLivenessWatch();
      return;
    }

    const idleMs = Date.now() - lastMessageAt;
    if (idleMs > keepaliveTimeoutMs + LIVENESS_GRACE_MS) {
      // Twitch guarantees a message (event or keepalive) within the keepalive
      // window. Missing it means the TCP connection died without a close frame.
      log.warn("EventSub keepalive timed out, reconnecting", {
        idle_ms: idleMs,
        keepalive_timeout_ms: keepaliveTimeoutMs,
      });
      stopLivenessWatch();
      ws = undefined;
      boundSessionId = undefined;
      terminate(socket);
      scheduleReconnect();
    }
  }, LIVENESS_CHECK_INTERVAL_MS);
}

function stopLivenessWatch(): void {
  if (livenessTimer) {
    clearInterval(livenessTimer);
    livenessTimer = undefined;
  }
}

function stopShardHealthcheck(): void {
  if (healthcheckTimer) {
    clearInterval(healthcheckTimer);
    healthcheckTimer = undefined;
  }
}

function startShardHealthcheck(): void {
  if (healthcheckTimer) return;
  healthcheckTimer = setInterval(() => {
    void rebindShardIfNeeded();
  }, SHARD_HEALTHCHECK_INTERVAL_MS);
}

/**
 * Compares the conduit shard against the current WebSocket session. If Twitch
 * disabled the shard or it still points at an old session, rebind it (Twitch
 * drops notifications when no enabled shard can receive them).
 */
export async function rebindShardIfNeeded(): Promise<void> {
  if (!ws || !boundSessionId) return;

  try {
    const shards = await getConduitShards();
    const shard = shards.find((candidate) => String(candidate.id) === String(SHARD_ID));
    if (!shard) {
      log.warn("conduit shard not found during healthcheck", {
        conduit_id: CONDUIT_ID,
        shard_id: SHARD_ID,
      });
      return;
    }

    const shardSessionId = shard.transport?.session_id;
    if (shard.status !== "enabled" || shardSessionId !== boundSessionId) {
      log.warn("conduit shard out of sync, rebinding", {
        shard_status: shard.status,
        shard_session_id: shardSessionId,
        active_session_id: boundSessionId,
      });
      await updateShard(boundSessionId, SHARD_ID);
    }
  } catch (error) {
    log.warn("conduit shard healthcheck failed", { error });
  }
}

/** Reacts to a `conduit.shard.disabled` notification from Twitch. */
export async function handleShardDisabled(shardId: unknown): Promise<void> {
  if (Number(shardId) !== SHARD_ID) return;

  log.warn("conduit shard disabled by Twitch, rebinding", { shard_id: SHARD_ID });
  await rebindShardIfNeeded();
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
    let settled = false;
    let connectTimeout: ReturnType<typeof setTimeout> | undefined;

    const settle = (action: "resolve" | "reject", value?: unknown): void => {
      if (settled) return;
      settled = true;
      if (connectTimeout) clearTimeout(connectTimeout);
      if (action === "resolve") resolve();
      else reject(value);
    };

    connectTimeout = setTimeout(() => {
      console.error(`WebSocket connection timed out after ${CONNECT_TIMEOUT_MS}ms`);
      terminate(socket);
      settle("reject", new Error("WebSocket connection timeout"));
    }, CONNECT_TIMEOUT_MS);

    socket.on("open", () => {
      console.log(
        "WebSocket connected to EventSub, waiting for session_welcome...",
      );
    });

    socket.on("message", async (raw: any) => {
      if (socket === ws) lastMessageAt = Date.now();

      try {
        const msg = JSON.parse(raw.toString());
        const type = msg.metadata?.message_type;

        switch (type) {
          case "session_welcome": {
            welcomed = true;
            // The connection is established; only the shard bind (with its own
            // retries) remains, so stop watching for a missing welcome.
            if (connectTimeout) clearTimeout(connectTimeout);
            ws = socket;
            reconnectingFrom = undefined;

            const sessionId: string = msg.payload?.session?.id;
            const reported = Number(msg.payload?.session?.keepalive_timeout_seconds);
            keepaliveTimeoutMs = reported > 0 ? reported * 1_000 : DEFAULT_KEEPALIVE_TIMEOUT_MS;

            // Twitch keeps the old connection alive until this Welcome arrives.
            // A reconnect URL already transfers the conduit shard automatically.
            if (shouldUpdateShard) {
              try {
                await onSessionWelcome(sessionId);
              } catch (error) {
                // A live socket that is not bound to a shard looks healthy but
                // silently drops every notification, so fail the connection and
                // let the reconnect loop (with token refresh) try again.
                log.error("failed to bind EventSub session to conduit shard", {
                  session_id: sessionId,
                  error,
                });
                ws = undefined;
                boundSessionId = undefined;
                stopLivenessWatch();
                terminate(socket);
                settle("reject", error);
                scheduleReconnect();
                return;
              }
            }

            boundSessionId = sessionId;
            if (previousWs && previousWs !== socket) previousWs.close();
            startLivenessWatch(socket);
            startShardHealthcheck();
            settle("resolve");
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
          case "notification": {
            const messageId = msg.metadata?.message_id;
            if (!beginEventMessage(messageId)) {
              log.warn("duplicate notification skipped", {
                message_id: messageId,
                subscription_type: msg.payload?.subscription?.type,
              });
              break;
            }
            try {
              await onNotification(msg.payload);
            } catch (err) {
              // Обработка не удалась — освобождаем id для повторной доставки
              releaseEventMessage(messageId);
              throw err;
            }
            completeEventMessage(messageId);
            break;
          }
          case "revocation":
            log.error("subscription revoked by Twitch", {
              subscription_type: msg.payload?.subscription?.type,
              status: msg.payload?.subscription?.status,
              broadcaster_user_id: msg.payload?.subscription?.condition?.broadcaster_user_id,
            });
            await resubscribeRevoked(msg.payload?.subscription);
            break;
        }
      } catch (error) {
        console.error("WebSocket message handling failed:", error);
        if (!welcomed) {
          socket.close();
          settle("reject", error);
        }
      }
    });

    socket.on("close", (code: any) => {
      if (!welcomed) {
        settle("reject", new Error(`WebSocket closed before welcome (code ${code})`));
      }
      if (socket !== ws) return;

      stopLivenessWatch();
      stopShardHealthcheck();
      ws = undefined;
      boundSessionId = undefined;
      if (reconnectingFrom === socket) return;

      console.warn(`❌ WebSocket closed (code ${code}), reconnecting...`);
      scheduleReconnect();
    });

    socket.on("error", (error: any) => {
      console.error("WebSocket error:", error.message);
      if (!welcomed) settle("reject", error);
    });
  });
}
