import { sleep } from "bun";
import { KICK_APP_TOKEN, KICK_OAUTH } from "../config";
import logger from "../logger";
import { getKickAppToken } from "./auth";

const log = logger.getSubLogger({ name: "kickAPI:subscriptions" });


export async function subscribeToKickChannelOnline(broadcasterId: number, broadcaster_name: string): Promise<number> {

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
      broadcaster_name: broadcaster_name,
    });
    return 202;
  } else if (res.status === 429) {
    log.warn("eventsub error: rate limit", {
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
    })
    await sleep(10000)
    return subscribeToKickChannelOnline(broadcasterId, broadcaster_name)
  } else if (res.status === 401) {
    await getKickAppToken();
    log.warn("eventsub error: unauthorized", {
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
    } )
    await sleep(10000);
    return subscribeToKickChannelOnline(broadcasterId, broadcaster_name)
  } else {
    log.error("subscription error", {
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
    });
    return -1;
  }
}
