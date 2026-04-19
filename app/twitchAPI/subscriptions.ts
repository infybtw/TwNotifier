import { APP_TOKEN, BOT_USER_ID, CLIENT_ID, CONDUIT_ID } from "../config";
import fetch from "node-fetch";

export async function subscribeToChannelOnline(broadcasterId: string) {
  const subscription = {
    type: "stream.online",
    version: "1",
    condition: { broadcaster_user_id: broadcasterId, user_id: BOT_USER_ID },
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
    console.log(`[${broadcasterId}]Subscribed to ${subscription.type}`);
  } else if (data.status === 409) {
    console.log(`[${broadcasterId}]Already subscribed ${subscription.type}`);
  } else {
    console.error(
      `[${broadcasterId}]Subscription error ${subscription.type}:`,
      data.message,
    );
  }
}

export async function getBroadcasterIdByLogin(login: string): Promise<number> {
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, {
    headers: {
      "Client-Id": CLIENT_ID,
      Authorization: `Bearer ${APP_TOKEN}`,
    },
  });

  const data = await res.json();
  const broadcasterId = data.data[0]?.id;
  return broadcasterId;
}
