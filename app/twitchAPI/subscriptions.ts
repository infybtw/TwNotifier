import { APP_TOKEN, BOT_USER_ID, CLIENT_ID, CONDUIT_ID } from "../config";
import fetch from "node-fetch";
import { getAllChannels } from "../database/db";
import logger from "../logger";

const log = logger.getSubLogger({ name: "twitchAPI:subscriptions" });

export async function subscribeToChannelOnline(
  broadcasterId: number,
  broadcaster_name: string,
) {
  const subscription = {
    type: "stream.online",
    version: "1",
    condition: {
      broadcaster_user_id: String(broadcasterId),
    },
  };

  const res = await fetch(
    "https://api.twitch.tv/helix/eventsub/subscriptions",
    {
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
    },
  );

  const data = await res.json();
  if (res.status === 202) {
    log.info("subscribed to event", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
    });
  } else if (data.status === 409) {
    log.info("allready subscribed", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
    });
  } else {
    log.error("subscription error", {
      type: subscription.type,
      broadcaster_id: broadcasterId,
      broadcaster_name: broadcaster_name,
      error_message: data.message,
    });
  }
}

export async function subscribeAllStreams() {
  const channels = getAllChannels.all();
  for (const channel of channels) {
    await subscribeToChannelOnline(channel.channel_id, channel.channel_name);
  }
  log.info("subscribed to all channels");
}
