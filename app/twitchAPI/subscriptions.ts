import { sleep } from "bun";
import {
  APP_TOKEN,
  BOT_USER_ID,
  CLIENT_ID,
  CONDUIT_ID,
  TWITCH_HELIX,
  TWITCH_OAUTH,
} from "../config";
import {getChannels, getChannelsByPlatform } from "../database/db";
import logger from "../logger";
import { getAppToken } from "./auth";

const log = logger.getSubLogger({ name: "twitchAPI:subscriptions" });

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
      transport: {
        method: "conduit", // ← не websocket, а conduit!
        conduit_id: CONDUIT_ID,
      },
    }),
  });

  const data = await res.json();

  if (res.status === 202) {
    log.info("subscribed to event", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
    });
    return 202;
  } else if (data.status === 409) {
    log.info("allready subscribed", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
    });
    return 409;
  } else if (res.status === 429) {
    log.warn("eventsub error: rate limit", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
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
      error_message: data.message,
    } )
    await sleep(10000);
    return subscribeToChannelOnline(broadcasterId, broadcaster_name)
  } else {
    log.error("subscription error", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      error_message: data.message,
    });
    return -1;
  }
}

export async function subscribeAllStreamsOnline() {
  const channels = await getChannelsByPlatform("twitch");
  for (const channel of channels) {
    await subscribeToChannelOnline(channel.channel_id, channel.channel_name);
  }
  log.info("subscribed to all channels online");
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
      transport: {
        method: "conduit",
        conduit_id: CONDUIT_ID,
      },
    }),
  });

  const data = await res.json();
  if (res.status === 202) {
    log.info("subscribed to event", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
    });
    return 202;
  } else if (data.status === 409) {
    log.info("allready subscribed", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
    });
    return 409;
  } else if (res.status === 429) {
    log.warn("eventsub error: rate limit", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
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
      error_message: data.message,
    } )
    await sleep(10000);
    return subscribeToChannelOffline(broadcasterId, broadcaster_name)
  } else {
    log.error("subscription error", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      error_message: data.message,
    });
    return -1;
  }
}

export async function subscribeAllStreamsOffline() {
  const channels = await getChannelsByPlatform("twitch");
  for (const channel of channels) {
    await subscribeToChannelOffline(channel.channel_id, channel.channel_name);
  }
  log.info("subscribed to all channels offline");
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

export async function deleteSubs(subs: TwitchEventSubSubscription[]) {
  console.log("get subs: " + subs.length)
  for (const sub of subs) {
    await deleteSub(sub)
  }
}
