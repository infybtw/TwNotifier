import { APP_TOKEN, CLIENT_ID, TWITCH_HELIX } from "../config";
import logger from "../logger";

const log = logger.getSubLogger({ name: "twitchAPI:users" });

export async function getUserId(login: string): Promise<number> {
  const url = new URL(TWITCH_HELIX + "/helix/users");
  url.searchParams.set("login", login);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${APP_TOKEN}`,
      "Client-Id": CLIENT_ID,
    },
  });

  const data = await res.json();
  if (res.status === 200) {
    try {
      const broadcaster_id = data.data[0].id;
      return data.data[0].id;
    } catch (err) {
      return -1;
    }
  } else {
    return -1;
  }
}

export async function getChannelInfo(broadcaster_id: number) {
  const url = new URL(TWITCH_HELIX + "/helix/channels");
  url.searchParams.set("broadcaster_id", String(broadcaster_id));

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${APP_TOKEN}`,
      "Client-Id": CLIENT_ID,
    },
  });

  const data = await res.json();
  if (res.status === 200) {
    return data.data[0];
  } else {
    log.warn("request failed", { status: res.status });
    return null;
  }
}
