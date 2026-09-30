import { sleep } from "bun";
import {
  APP_TOKEN,
  BOT_USER_ID,
  BOT_URL,
  CLIENT_ID,
  CONDUIT_ID,
  TWITCH_EVENT_TRANSPORT,
  TWITCH_HELIX,
  TWITCH_OAUTH,
  TWITCH_WEBHOOK_PATH,
  TWITCH_WEBHOOK_SECRET,
} from "../config";
import {
  getChannelByChannelIdAndPlatform,
  getChannelFollowersByChannelIdAndPlatform,
  getChannelsWithFollowersByPlatform,
} from "../database/db";
import logger from "../logger";
import { getAppToken } from "./auth";

const log = logger.getSubLogger({ name: "twitchAPI:subscriptions" });

export type ProgressCallback = (progress: { current: number; total: number; phase: string }) => void;

function getTransport() {
  if (TWITCH_EVENT_TRANSPORT === "webhook") {
    return {
      method: "webhook",
      callback: BOT_URL + TWITCH_WEBHOOK_PATH,
      secret: TWITCH_WEBHOOK_SECRET,
    };
  }
  return {
    method: "conduit",
    conduit_id: CONDUIT_ID,
  };
}

export async function subscribeToChannelOnline(broadcasterId: number, broadcaster_name: string): Promise<number> {
  const subscription = {
    type: "stream.online",
    version: "1",
    condition: {
      broadcaster_user_id: String(broadcasterId),
    },
  };

  const res = await fetch(TWITCH_HELIX + "/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${APP_TOKEN}`, // <- App токен! <--
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...subscription,
      transport: getTransport(),
    }),
  });

  const data = await res.json();

  if (res.status === 202) {
    log.info("subscribed to event", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
    });
    return 202;
  } else if (data.status === 409) {
    log.info("allready subscribed", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
    });
    return 409;
  } else if (res.status === 429) {
    log.warn("eventsub error: rate limit", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
      error_message: data.message,
    })
    await sleep(10000)
    return subscribeToChannelOnline(broadcasterId, broadcaster_name)
  } else if (res.status === 401) {
    await getAppToken();
    log.warn("eventsub error: unauthorized", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
      error_message: data.message,
    } )
    await sleep(10000);
    return subscribeToChannelOnline(broadcasterId, broadcaster_name)
  } else {
    log.error("subscription error", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
      error_message: data.message,
    });
    return -1;
  }
}

export async function subscribeAllStreamsOnline(onProgress?: ProgressCallback) {
  const channels = await getChannelsWithFollowersByPlatform("twitch");
  for (let i = 0; i < channels.length; i++) {
    await subscribeToChannelOnline(channels[i].channel_id, channels[i].channel_name);
    if (onProgress) {
      onProgress({ current: i + 1, total: channels.length, phase: "Subscribing online" });
    }
  }
  log.info("subscribed to all channels online", { count: channels.length });
}

export async function subscribeToChannelOffline(broadcasterId: number, broadcaster_name: string): Promise<number> {
  const subscription = {
    type: "stream.offline",
    version: "1",
    condition: {
      broadcaster_user_id: String(broadcasterId),
    },
  };

  const res = await fetch(TWITCH_HELIX + "/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${APP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...subscription,
      transport: getTransport(),
    }),
  });

  const data = await res.json();
  if (res.status === 202) {
    log.info("subscribed to event", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
    });
    return 202;
  } else if (data.status === 409) {
    log.info("allready subscribed", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
    });
    return 409;
  } else if (res.status === 429) {
    log.warn("eventsub error: rate limit", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
      error_message: data.message,
    })
    await sleep(10000)
    return subscribeToChannelOffline(broadcasterId, broadcaster_name)
  } else if (res.status === 401) {
    await getAppToken();
    log.warn("eventsub error: unauthorized", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
      error_message: data.message,
    } )
    await sleep(10000);
    return subscribeToChannelOffline(broadcasterId, broadcaster_name)
  } else {
    log.error("subscription error", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      transport: TWITCH_EVENT_TRANSPORT,
      error_message: data.message,
    });
    return -1;
  }
}

export async function subscribeAllStreamsOffline(onProgress?: ProgressCallback) {
  const channels = await getChannelsWithFollowersByPlatform("twitch");
  for (let i = 0; i < channels.length; i++) {
    await subscribeToChannelOffline(channels[i].channel_id, channels[i].channel_name);
    if (onProgress) {
      onProgress({ current: i + 1, total: channels.length, phase: "Subscribing offline" });
    }
  }
  log.info("subscribed to all channels offline", { count: channels.length });
}

export async function subscribeToChannelUpdate(broadcasterId: number, broadcaster_name: string): Promise<number> {
  const subscription = {
    type: "channel.update",
    version: "2",
    condition: { broadcaster_user_id: String(broadcasterId) },
  };
  const res = await fetch(TWITCH_HELIX + "/helix/eventsub/subscriptions", {
    method: "POST",
    headers: { "Client-ID": CLIENT_ID, Authorization: `Bearer ${APP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...subscription, transport: getTransport() }),
  });
  const data = await res.json();
  if (res.status === 202 || data.status === 409) {
    log.info(res.status === 202 ? "subscribed to event" : "already subscribed", {
      type: subscription.type, broadcaster_id: broadcasterId, broadcaster_name, transport: TWITCH_EVENT_TRANSPORT,
    });
    return res.status === 202 ? 202 : 409;
  }
  log.error("subscription error", {
    type: subscription.type, broadcaster_id: broadcasterId, broadcaster_name, transport: TWITCH_EVENT_TRANSPORT, error_message: data.message,
  });
  return -1;
}

export async function subscribeAllChannelUpdates(onProgress?: ProgressCallback) {
  const channels = await getChannelsWithFollowersByPlatform("twitch");
  for (let i = 0; i < channels.length; i++) {
    await subscribeToChannelUpdate(channels[i].channel_id, channels[i].channel_name);
    onProgress?.({ current: i + 1, total: channels.length, phase: "Subscribing channel updates" });
  }
  log.info("subscribed to all channel updates", { count: channels.length });
}

/**
 * Best-effort recovery after Twitch revoked a subscription: re-create it when
 * the channel still exists and still has followers. Failures are logged and
 * never retried in a loop.
 */
export async function resubscribeRevoked(subscription: any): Promise<void> {
  const type: string | undefined = subscription?.type;
  const broadcasterId = Number(subscription?.condition?.broadcaster_user_id);
  if (!type || !Number.isSafeInteger(broadcasterId) || broadcasterId <= 0) return;

  try {
    const channel = await getChannelByChannelIdAndPlatform(broadcasterId, "twitch");
    if (!channel) return;
    const followers = await getChannelFollowersByChannelIdAndPlatform(broadcasterId, "twitch");
    if (followers.length === 0) return;

    const name = channel.channel_name ?? "";
    let result = -1;
    if (type === "stream.online") {
      result = await subscribeToChannelOnline(broadcasterId, name);
    } else if (type === "stream.offline") {
      result = await subscribeToChannelOffline(broadcasterId, name);
    } else if (type === "channel.update") {
      result = await subscribeToChannelUpdate(broadcasterId, name);
    } else {
      return;
    }

    log.warn("re-created revoked subscription", {
      type,
      broadcaster_id: broadcasterId,
      result,
    });
  } catch (error) {
    log.error("failed to re-create revoked subscription", {
      type,
      broadcaster_id: broadcasterId,
      error,
    });
  }
}

/**
 * Subscribes to `conduit.shard.disabled` so a shard Twitch disabled after a
 * dropped WebSocket session is noticed and can be rebound.
 */
export async function subscribeToShardDisabled(conduitId: string = CONDUIT_ID, retry = true): Promise<number> {
  const res = await fetch(TWITCH_HELIX + "/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${APP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "conduit.shard.disabled",
      version: "1",
      condition: { client_id: CLIENT_ID, conduit_id: conduitId },
      transport: getTransport(),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 202) {
    log.info("subscribed to event", { type: "conduit.shard.disabled", transport: TWITCH_EVENT_TRANSPORT });
    return 202;
  }
  if (data?.status === 409 || res.status === 409) {
    log.info("already subscribed", { type: "conduit.shard.disabled", transport: TWITCH_EVENT_TRANSPORT });
    return 409;
  }
  if (res.status === 401 && retry) {
    await getAppToken();
    return subscribeToShardDisabled(conduitId, false);
  }

  log.error("subscription error", {
    type: "conduit.shard.disabled",
    transport: TWITCH_EVENT_TRANSPORT,
    error_message: data?.message,
  });
  return -1;
}

export async function getEventSubList(cursor?: string, retries = 3): Promise<TwitchEventSubSubscription[]> {
  const url = new URL(TWITCH_HELIX + "/helix/eventsub/subscriptions");
  if (cursor) url.searchParams.set("after", cursor);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: `Bearer ${APP_TOKEN}`,
      },
    });
  } catch (err) {
    if (retries <= 0) throw new Error("getEventSubList: network error after retries");
    await sleep(10000);
    return getEventSubList(cursor, retries - 1);
  }

  if (res.status === 401) {
    await getAppToken();
    if (retries <= 0) throw new Error("getEventSubList: unauthorized after retries");
    await sleep(10000);
    return getEventSubList(cursor, retries - 1);
  }

  if (res.status !== 200) {
    if (retries <= 0) throw new Error(`getEventSubList: status ${res.status} after retries`);
    await sleep(10000);
    return getEventSubList(cursor, retries - 1);
  }

  const data: TwitchGetEventSubSubscriptionsResponse = await res.json();

  if (data.pagination?.cursor) {
    const nextPage = await getEventSubList(data.pagination.cursor);
    return [...data.data, ...nextPage];
  }

  return data.data;
}

async function deleteSub(sub: TwitchEventSubSubscription, retries = 3) {
  const url = new URL(TWITCH_HELIX + "/helix/eventsub/subscriptions");
  url.searchParams.set("id", sub.id)
  let res: Response;
  try {
    res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: `Bearer ${APP_TOKEN}`,
      },
    });
  } catch (err) {
    if (retries <= 0) throw new Error("deleteSub: network error after retries");
    await sleep(10000);
    return deleteSub(sub, retries - 1);
  }

  if (res.status === 204) {
    log.info("sub deleted", {
      type: sub.type,
      broadcaster_id: sub.condition.broadcaster_user_id,
      status: res.status,
    })
    return;
  } else if (res.status === 401) {
    log.warn("eventsub error: unauthorized", {
      type: sub.type,
      broadcaster_id: sub.condition.broadcaster_user_id,
      status: res.status,
    } )
    await getAppToken();
    if (retries <= 0) throw new Error("deleteSub: unauthorized after retries");
    await sleep(10000);
    return deleteSub(sub, retries - 1);
  } else if (res.status === 404) {
    return;
  } else {
    log.error("failed to delete sub", {
      type: sub.type,
      broadcaster_id: sub.condition.broadcaster_user_id,
      status: res.status,
    })
    return
  }
}

export async function deleteSubs(subs: TwitchEventSubSubscription[], onProgress?: ProgressCallback) {
  console.log("get subs: " + subs.length)
  for (let i = 0; i < subs.length; i++) {
    await deleteSub(subs[i])
    if (onProgress) {
      onProgress({ current: i + 1, total: subs.length, phase: "Deleting subscriptions" });
    }
  }
}
