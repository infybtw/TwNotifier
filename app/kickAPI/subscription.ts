import { sleep } from "bun";
import { KICK_APP_TOKEN, KICK_API, KICK_OAUTH } from "../config";
import logger from "../logger";
import { getKickAppToken } from "./auth";
import { getChannelsWithFollowersByPlatform } from "../database/db";

const log = logger.getSubLogger({ name: "kickAPI:subscriptions" });

interface KickGetSubscriptionsResponse {
  data: KickSubscriptionData[],
  message: string
}

interface KickSubscriptionData {
  app_id: string,
  broadcaster_user_id: number,
  created_at: string,
  event: string,
  id: string,
  method: string,
  updated_at: string,
  version: number
}


export async function subscribeToKickChannelOnline(broadcasterId: number): Promise<number> {
  // Раздельные запросы: конфликт уже существующей status-подписки не должен
  // мешать созданию metadata-подписки.
  for (const event of ["livestream.status.updated", "livestream.metadata.updated"]) {
    if (await subscribeToKickEvent(broadcasterId, event) !== 202) return -1;
  }
  return 202;
}

async function subscribeToKickEvent(broadcasterId: number, event: string): Promise<number> {

  const res = await fetch(`${KICK_API}/public/v1/events/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KICK_APP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_user_id: broadcasterId,
      events: [
        {
          name: event,
          version: 1
        },
      ],
      method: "webhook"
    }),
  });

  const data = await res.json();


  if (res.status === 200 || res.status === 201 || res.status === 409) {
    if (res.status !== 409 && (!data.data?.length || data.data.some((sub: { error?: string }) => sub.error))) {
      // Kick can report an existing subscription as a per-event error in a
      // successful response. Confirm it exists rather than swallowing errors.
      const existing = await getKickSubscriptions();
      if (!existing.some((sub) => Number(sub.broadcaster_user_id) === broadcasterId && sub.event === event && sub.version === 1)) {
        log.error("subscription event error", { event, broadcaster_id: broadcasterId, data });
        return -1;
      }
    }
    log.info("subscribed to event", {
      event,
      broadcaster_id: broadcasterId,
      status: res.status,
    });
    return 202;
  } else if (res.status === 429) {
    log.warn("eventsub error: rate limit", {
      broadcaster_id: broadcasterId,
    })
    await sleep(10000)
    return subscribeToKickEvent(broadcasterId, event)
  } else if (res.status === 401) {
    await getKickAppToken();
    log.warn("eventsub error: unauthorized", {
      broadcaster_id: broadcasterId,
    } )
    await sleep(10000);
    return subscribeToKickEvent(broadcasterId, event)
  } else {
    log.error("subscription error", {
      broadcaster_id: broadcasterId,
    });
    return -1;
  }
}

/** Upgrade existing active subscriptions without recreating or enabling disconnected ones. */
export async function ensureKickMetadataSubscriptions(): Promise<void> {
  const subscriptions = await getKickSubscriptions();
  const channels = await getChannelsWithFollowersByPlatform("kick");
  const activeChannels = new Set(subscriptions.filter((sub) => sub.event === "livestream.status.updated").map((sub) => Number(sub.broadcaster_user_id)));
  const metadataChannels = new Set(subscriptions.filter((sub) => sub.event === "livestream.metadata.updated").map((sub) => Number(sub.broadcaster_user_id)));
  for (const channel of channels) {
    if (activeChannels.has(channel.channel_id) && !metadataChannels.has(channel.channel_id)) {
      if (await subscribeToKickEvent(channel.channel_id, "livestream.metadata.updated") !== 202) {
        throw new Error(`Failed to subscribe to Kick metadata for ${channel.channel_id}`);
      }
    }
  }
}

export async function getKickSubscriptions(): Promise<KickSubscriptionData[]> {
  const res = await fetch(`${KICK_API}/public/v1/events/subscriptions`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${KICK_APP_TOKEN}`,
    }
  })

  switch (res.status) {
    case 200:
      const data: KickGetSubscriptionsResponse = await res.json()
      return data.data
    case 401:
      log.warn("get subscriptions error: unauthorized", {
        status: res.status
      })
      await getKickAppToken();
      await sleep(10000);
      return getKickSubscriptions()
    default:
      await sleep(10000);
      return getKickSubscriptions()
  }
}

export type ProgressCallback = (progress: { current: number; total: number; phase: string }) => void;

export async function deleteKickSubscriptions(subs: KickSubscriptionData[], onProgress?: ProgressCallback): Promise<void> {
  for (let i = 0; i < subs.length; i++) {
    await deleteKickSubscription(subs[i]);
    if (onProgress) {
      onProgress({ current: i + 1, total: subs.length, phase: "Deleting subscriptions" });
    }
  }
}

export async function subscribeToKickChannelsOnline(channelIds: number[], onProgress?: ProgressCallback): Promise<void> {
  for (let i = 0; i < channelIds.length; i++) {
    await subscribeToKickChannelOnline(channelIds[i]);
    if (onProgress) {
      onProgress({ current: i + 1, total: channelIds.length, phase: "Subscribing online" });
    }
  }
}

export async function deleteKickSubscription(sub: KickSubscriptionData): Promise<void>{
  const url = new URL(`${KICK_API}/public/v1/events/subscriptions`)
  url.searchParams.set("id", sub.id)

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${KICK_APP_TOKEN}`,
    }
  })

  switch (res.status) {
    case 204:
      log.info("sub deleted", {
        type: sub.event,
        broadcaster_id: sub.broadcaster_user_id,
        status: res.status,
      })
      break
    case 401:
      log.warn("delete subscription error: unauthorized", {
        type: sub.event,
        broadcaster_id: sub.broadcaster_user_id,
        status: res.status
      })
      await getKickAppToken();
      await sleep(10000);
      return deleteKickSubscription(sub)
    default:
      log.warn("delete subscription error", {
        type: sub.event,
        broadcaster_id: sub.broadcaster_user_id,
        status: res.status
      })
      await sleep(10000)
      return deleteKickSubscription(sub)
  }
}
