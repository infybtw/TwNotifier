import { APP_TOKEN, CLIENT_ID, TWITCH_HELIX } from "../config";
import logger from "../logger";
import { TwitchUser } from "../models/twitch_user";

const log = logger.getSubLogger({ name: "twitchAPI:users" });

export async function getUserByLogin(
  login: string,
): Promise<TwitchUser | null> {
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
  if (res.status === 200 && data.data && data.data.length > 0) {
    return data.data[0];
  }
  return null;
}

export async function getUserById(
  id: number | string,
): Promise<TwitchUser | null> {
  const url = new URL(TWITCH_HELIX + "/helix/users");
  url.searchParams.set("id", String(id));

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${APP_TOKEN}`,
      "Client-Id": CLIENT_ID,
    },
  });

  const data = await res.json();
  if (res.status === 200 && data.data && data.data.length > 0) {
    return data.data[0];
  }
  return null;
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
