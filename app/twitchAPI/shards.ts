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

/** Requested via `keepalive_timeout_seconds` query param (Twitch allows 10–600). */
const KEEPALIVE_TIMEOUT_SECONDS = 60;
/** Keepalive window used until the welcome message reports the actual value. */
const DEFAULT_KEEPALIVE_TIMEOUT_MS = KEEPALIVE_TIMEOUT_SECONDS * 1_000;
/** How often the liveness watchdog inspects the last inbound message. */
const LIVENESS_CHECK_INTERVAL_MS = 5_000;
/** Extra budget on top of keepalive_timeout before the connection is deemed dead. */
const LIVENESS_GRACE_MS = 10_000;
/** Abort a connection attempt that never yields a welcome message. */
const CONNECT_TIMEOUT_MS = 15_000;
/** How often the conduit shard is compared against the live WebSocket session. */
const SHARD_HEALTHCHECK_INTERVAL_MS = 60_000;
/** First reconnect delay; grows exponentially with jitter. */
const RECONNECT_BASE_DELAY_MS = 1_000;
/** Upper bound for the reconnect delay. */
const RECONNECT_MAX_DELAY_MS = 60_000;
/** updateShard attempts before giving up. */
const SHARD_UPDATE_MAX_ATTEMPTS = 5;

let ws: WebSocket | undefined;
let baseUrl: string;
let reconnectingFrom: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let livenessTimer: ReturnType<typeof setInterval> | undefined;
let healthcheckTimer: ReturnType<typeof setInterval> | undefined;
/** Socket waiting to be closed once its replacement is welcomed. */
let pendingPreviousWs: WebSocket | undefined;
/** Consecutive failed reconnect attempts; reset on every welcome. */
let reconnectAttempt = 0;

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

/** Error objects serialize to `{}` in JSON logs, so log their message instead. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Binds a WebSocket session to the conduit shard.
 *
 * Retry policy by failure type:
 * - 401: stale app token, refresh and retry;
 * - 429: rate-limited, back off without a token refresh;
 * - 5xx / network error: retry with backoff, no token refresh;
 * - other 4xx: request itself is invalid, fail fast without retries.
 */
export async function updateShard(sessionId: string, shardId: number): Promise<void> {
  let lastError: unknown;
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

      if (res.ok) {
        log.info("conduit shard bound to session", { shard_id: shardId, session_id: sessionId, attempt });
        return;
      }

      const text = await res.text().catch(() => "");
      let message: string | undefined;
      try {
        message = text ? (JSON.parse(text)?.message as string | undefined) : undefined;
      } catch {
        message = text || undefined;
      }

      if (res.status === 401) {
        log.warn("shard update unauthorized, refreshing app token", {
          shard_id: shardId,
          status: res.status,
          attempt,
          error_message: message,
        });
        try {
          await getAppToken();
        } catch (error) {
          log.error("failed to refresh Twitch app token", { error_message: errorMessage(error) });
        }
      } else if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        log.warn("shard update transient failure, backing off", {
          shard_id: shardId,
          status: res.status,
          attempt,
          error_message: message,
        });
      } else {
        // 400/403/404: retrying the same payload (or refreshing the token)
        // cannot help — fail immediately so the caller reconnects with a
        // fresh session instead of burning token refreshes.
        log.error("shard update rejected, not retrying", {
          shard_id: shardId,
          status: res.status,
          error_message: message,
        });
        throw new Error(`Update shard rejected with status ${res.status}: ${message ?? "unknown error"}`);
      }
      lastError = new Error(`Update shard failed with status ${res.status}: ${message ?? "unknown error"}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Update shard rejected")) {
        throw error;
      }
      log.warn("shard update request failed", {
        shard_id: shardId,
        attempt,
        error_message: errorMessage(error),
      });
      lastError = error;
    }

    if (attempt < SHARD_UPDATE_MAX_ATTEMPTS) {
      await sleep(attempt * 1_000);
    }
  }

  throw new Error(
    `Update shard failed after ${SHARD_UPDATE_MAX_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/** Exponential backoff with jitter for reconnect attempts. */
function reconnectDelayMs(attempt: number): number {
  const backoff = RECONNECT_BASE_DELAY_MS * 2 ** Math.min(attempt, 6);
  const capped = Math.min(backoff, RECONNECT_MAX_DELAY_MS);
  return capped + Math.floor(Math.random() * 1_000);
}

function scheduleReconnect(reason: string, previousWs?: WebSocket, opts?: { immediate?: boolean }): void {
  // Always remember the newest socket that needs closing; a deduped timer
  // must not lose the reference to it.
  if (previousWs) pendingPreviousWs = previousWs;
  if (reconnectTimer) {
    log.log("EventSub reconnect already scheduled, skipping", { reason });
    return;
  }

  const delay = opts?.immediate ? RECONNECT_BASE_DELAY_MS : reconnectDelayMs(reconnectAttempt);
  log.warn("scheduling EventSub reconnect", {
    reason,
    delay_ms: delay,
    attempt: reconnectAttempt + 1,
    immediate: Boolean(opts?.immediate),
    has_previous_socket: Boolean(pendingPreviousWs),
  });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    const previous = pendingPreviousWs;
    pendingPreviousWs = undefined;
    reconnectAttempt += 1;
    log.info("reconnecting to EventSub", { attempt: reconnectAttempt, reason });
    connect(baseUrl, previous, true).catch((error) => {
      log.error("EventSub reconnect attempt failed", {
        attempt: reconnectAttempt,
        error_message: errorMessage(error),
      });
      scheduleReconnect("connect_failed", previous);
    });
  }, delay);
}

/** Resets the reconnect backoff after a successful welcome. */
function resetReconnectBackoff(): void {
  reconnectAttempt = 0;
  pendingPreviousWs = undefined;
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
      scheduleReconnect("keepalive_timeout");
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
    log.warn("conduit shard healthcheck failed", { error_message: errorMessage(error) });
  }
}

/** Reacts to a `conduit.shard.disabled` notification from Twitch. */
export async function handleShardDisabled(shardId: unknown, conduitId?: unknown): Promise<void> {
  if (conduitId && String(conduitId) !== String(CONDUIT_ID)) return;
  if (Number(shardId) !== SHARD_ID) return;

  log.warn("conduit shard disabled by Twitch, rebinding", { shard_id: SHARD_ID });
  await rebindShardIfNeeded();
}

function withKeepaliveTimeout(url: string): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("keepalive_timeout_seconds")) {
    parsed.searchParams.set("keepalive_timeout_seconds", String(KEEPALIVE_TIMEOUT_SECONDS));
  }
  return parsed.toString();
}

function connect(
  url: string,
  previousWs?: WebSocket,
  shouldUpdateShard = false,
): Promise<void> {
  log.info("connecting to EventSub", {
    reconnect: Boolean(previousWs),
    update_shard: shouldUpdateShard,
  });
  const socket = new WebSocket(withKeepaliveTimeout(url));

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
      log.error("EventSub session_welcome not received in time", { timeout_ms: CONNECT_TIMEOUT_MS });
      terminate(socket);
      settle("reject", new Error("WebSocket connection timeout"));
    }, CONNECT_TIMEOUT_MS);

    socket.on("open", () => {
      log.info("EventSub socket open, waiting for session_welcome");
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
            resetReconnectBackoff();

            const sessionId: string = msg.payload?.session?.id;
            const reported = Number(msg.payload?.session?.keepalive_timeout_seconds);
            keepaliveTimeoutMs = reported > 0 ? reported * 1_000 : DEFAULT_KEEPALIVE_TIMEOUT_MS;
            log.info("EventSub session_welcome received", {
              session_id: sessionId,
              keepalive_timeout_ms: keepaliveTimeoutMs,
              update_shard: shouldUpdateShard,
            });

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
                  error_message: errorMessage(error),
                });
                ws = undefined;
                boundSessionId = undefined;
                stopLivenessWatch();
                terminate(socket);
                settle("reject", error);
                scheduleReconnect("bind_failed");
                return;
              }
            }

            boundSessionId = sessionId;
            if (previousWs && previousWs !== socket) {
              log.info("switched to new EventSub session, closing previous socket", { session_id: sessionId });
              previousWs.close();
            }
            startLivenessWatch(socket);
            startShardHealthcheck();
            settle("resolve");
            log.info("EventSub session active", {
              session_id: sessionId,
              path: shouldUpdateShard ? "bound_to_shard" : "reconnect_url",
            });

            if (!shouldUpdateShard) {
              // session_reconnect path: Twitch should have moved the shard
              // binding automatically, but with a single-shard conduit a missed
              // transfer means silently dropped notifications until the next
              // 60s healthcheck. Verify immediately instead.
              void rebindShardIfNeeded().catch((error) => {
                log.warn("post-reconnect shard verification failed", { error_message: errorMessage(error) });
              });
            }
            break;
          }
          case "session_keepalive":
            break;
          case "session_reconnect": {
            if (socket !== ws || reconnectingFrom === socket) break;

            const reconnectUrl = msg.payload.session.reconnect_url;
            log.warn("Twitch requested EventSub reconnect", {
              session_id: msg.payload.session?.id,
              has_reconnect_url: Boolean(reconnectUrl),
            });
            reconnectingFrom = socket;
            connect(reconnectUrl, socket).catch((error) => {
              log.error("EventSub reconnect_url attempt failed", { error_message: errorMessage(error) });
              if (!ws || ws === socket) {
                reconnectingFrom = undefined;
                // A reconnect URL becomes invalid after an unsuccessful attempt.
                scheduleReconnect("reconnect_url_failed", socket);
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
        log.error("EventSub message handling failed", {
          welcomed,
          error_message: errorMessage(error),
        });
        if (!welcomed) {
          socket.close();
          settle("reject", error);
        }
      }
    });

    socket.on("close", (code: any, reason: any) => {
      const numericCode = Number(code);
      const closeReason = reason?.toString() || undefined;
      if (!welcomed) {
        log.warn("EventSub socket closed before session_welcome", { code: numericCode, reason: closeReason });
        settle("reject", new Error(`WebSocket closed before welcome (code ${code})`));
      }
      if (socket !== ws) {
        if (welcomed) log.info("old EventSub socket closed", { code: numericCode, reason: closeReason });
        return;
      }

      stopLivenessWatch();
      stopShardHealthcheck();
      ws = undefined;
      boundSessionId = undefined;
      if (reconnectingFrom === socket) {
        log.info("EventSub socket closed during reconnect handover", { code: numericCode, reason: closeReason });
        return;
      }

      // Twitch close codes: 4003 = shard not bound in time (retry fast),
      // 4004 = reconnect grace expired, 4007 = invalid reconnect URL,
      // 4000/4005/4006 = transient server/network issues.
      log.warn("EventSub websocket closed, reconnecting", { code: numericCode, reason: closeReason });
      scheduleReconnect("socket_closed", undefined, { immediate: numericCode === 4003 });
    });

    socket.on("error", (error: any) => {
      log.error("EventSub socket error", { error_message: errorMessage(error) });
      if (!welcomed) settle("reject", error);
    });
  });
}
