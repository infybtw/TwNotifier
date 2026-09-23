import { APP_TOKEN, CLIENT_ID, TWITCH_HELIX } from "../config";
import { sleep } from "bun";
import logger from "../logger";
import { TwitchUser } from "../models/twitch_user";

const log = logger.getSubLogger({ name: "twitchAPI:users" });

export async function getUserByLogin(login: string): Promise<TwitchUser | null> {
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
  if (res.status === 200 && data.data[0] && data.data.length > 0) {
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

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  is_mature: boolean;
  thumbnail_url?: string;
}

const STREAM_PREVIEW_WIDTH = 1280;
const STREAM_PREVIEW_HEIGHT = 720;
const STREAM_PREVIEW_RETRY_MS = 5_000;

export function getStreamPreviewUrl(thumbnailUrl: string, timestamp = Date.now()): string {
  const url = new URL(
    thumbnailUrl
      .replace("{width}", String(STREAM_PREVIEW_WIDTH))
      .replace("{height}", String(STREAM_PREVIEW_HEIGHT)),
  );
  // Twitch updates the image at the same URL. A unique query parameter keeps
  // Telegram from reusing a previously cached stream frame.
  url.searchParams.set("t", String(timestamp));
  return url.toString();
}

async function isStreamPreviewAvailable(thumbnailUrl: string): Promise<boolean> {
  try {
    const response = await fetch(getStreamPreviewUrl(thumbnailUrl), {
      method: "HEAD",
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    log.warn("stream preview availability check failed", { error });
    return false;
  }
}

/**
 * Waits for Twitch to generate the stream thumbnail. If the stream ends (or a
 * newer stream starts) before that happens, no preview is returned.
 */
export async function waitForStreamPreview(userId: number, streamId: string): Promise<string | null> {
  while (true) {
    let stream: TwitchStream | undefined;
    try {
      [stream] = await getStreamsByUserIds([userId]);
    } catch (error) {
      log.warn("failed to fetch stream while waiting for preview", { user_id: userId, stream_id: streamId, error });
      await sleep(STREAM_PREVIEW_RETRY_MS);
      continue;
    }
    if (!stream || stream.id !== streamId) {
      log.info("stream ended before preview became available", { user_id: userId, stream_id: streamId });
      return null;
    }

    if (stream.thumbnail_url && await isStreamPreviewAvailable(stream.thumbnail_url)) {
      return stream.thumbnail_url;
    }

    await sleep(STREAM_PREVIEW_RETRY_MS);
  }
}

export async function getStreamsByUserIds(userIds: number[]): Promise<TwitchStream[]> {
  if (userIds.length === 0) return [];
  const url = new URL(TWITCH_HELIX + "/helix/streams");
  for (const id of userIds) {
    url.searchParams.append("user_id", String(id));
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${APP_TOKEN}`,
      "Client-Id": CLIENT_ID,
    },
  });

  const data = await res.json();
  if (res.status === 200 && data.data) {
    return data.data;
  }
  log.warn("getStreamsByUserIds failed", { status: res.status });
  return [];
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
