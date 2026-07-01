import { sleep } from "bun";
import { KICK_APP_TOKEN, KICK_OAUTH } from "../config";
import logger from "../logger";
import { getKickAppToken } from "./auth";

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

  const res = await fetch("https://api.kick.com/public/v1/events/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KICK_APP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_user_id: broadcasterId,
      events: [
        {
          name: "livestream.status.updated",
          version: 1
        },
      ],
      method: "webhook"
    }),
  });

  const data = await res.json();


  if (res.status === 200) {
    log.info("subscribed to event", {
      event: "livestream.status.updated",
      broadcaster_id: broadcasterId,
    });
    return 202;
  } else if (res.status === 429) {
    log.warn("eventsub error: rate limit", {
      broadcaster_id: broadcasterId,
    })
    await sleep(10000)
    return subscribeToKickChannelOnline(broadcasterId)
  } else if (res.status === 401) {
    await getKickAppToken();
    log.warn("eventsub error: unauthorized", {
      broadcaster_id: broadcasterId,
    } )
    await sleep(10000);
    return subscribeToKickChannelOnline(broadcasterId)
  } else {
    log.error("subscription error", {
      broadcaster_id: broadcasterId,
    });
    return -1;
  }
}

export async function getKickSubscriptions(): Promise<KickSubscriptionData[]> {
  const res = await fetch("https://api.kick.com/public/v1/events/subscriptions", {
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

export async function deleteKickSubscription(sub: KickSubscriptionData): Promise<void>{
  const url = new URL("https://api.kick.com/public/v1/events/subscriptions")
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
