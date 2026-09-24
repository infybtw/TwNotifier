import { sleep } from "bun"
import { KICK_APP_TOKEN, KICK_API } from "../config"
import logger from "../logger"
import { getKickAppToken } from "./auth"

const log = logger.getSubLogger({ name: "kickAPI:users"})

const STREAM_PREVIEW_RETRY_MS = 5_000;


export interface KickOnlineChannel {
  slug: string;
  is_live: boolean;
  stream_title: string;
  viewer_count: number;
  category: { name: string } | null;
}

export async function getKickChannelsOnline(usernames: string[]): Promise<KickOnlineChannel[]> {
  if (usernames.length === 0) return [];
  const results = await Promise.all(
    usernames.map(async (username) => {
      try {
        const res = await getKickChannelByUsername(username);
        const ch = res.data?.[0];
        if (!ch) return null;
        return {
          slug: ch.slug,
          is_live: ch.stream?.is_live ?? false,
          stream_title: ch.stream_title ?? "",
          viewer_count: ch.stream?.viewer_count ?? 0,
          category: ch.stream ? { name: ch.category?.name ?? "" } : null,
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is KickOnlineChannel => r !== null);
}

export async function getKickChannelByUsername(username: string, attempt = 0): Promise<KickChannelResponse> {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 2_000;

  const url = new URL(`${KICK_API}/public/v1/channels`)
  url.searchParams.set("slug", username)

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${KICK_APP_TOKEN}`
    }
  })

  const data: KickChannelResponse = await res.json()

  if (res.status === 200) {
    return data;
  }

  // Bad request / not found: the slug is invalid or no such channel exists.
  // Do not retry, otherwise a malformed name causes an endless request loop.
  if (res.status === 400 || res.status === 404) {
    log.info("channel not found", { status: res.status, username });
    return { data: [], message: data?.message ?? "not found" };
  }

  if (attempt >= MAX_ATTEMPTS) {
    log.error("request failed, giving up", { status: res.status, username, attempt });
    return { data: [], message: data?.message ?? "request failed" };
  }

  if (res.status === 401) {
    log.warn("request failed: unauthorized", { status: res.status, username, attempt });
    await getKickAppToken();
  } else {
    log.warn("request failed, retrying", { status: res.status, username, attempt });
  }

  await sleep(RETRY_DELAY_MS);
  return getKickChannelByUsername(username, attempt + 1);
}

export function getKickStreamPreviewUrl(thumbnailUrl: string, timestamp = Date.now()): string {
  const url = new URL(thumbnailUrl);
  // Kick updates the preview at the same URL. Prevent Telegram from reusing a
  // cached frame from an earlier notification.
  url.searchParams.set("t", String(timestamp));
  return url.toString();
}

async function isKickStreamPreviewAvailable(thumbnailUrl: string): Promise<boolean> {
  try {
    const response = await fetch(getKickStreamPreviewUrl(thumbnailUrl), {
      method: "HEAD",
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    log.warn("stream preview availability check failed", { error });
    return false;
  }
}

/** Waits for Kick to generate a preview, unless the stream has ended first. */
export async function waitForKickStreamPreview(channelName: string): Promise<string | null> {
  while (true) {
    try {
      const channel = (await getKickChannelByUsername(channelName)).data?.[0];
      const stream = channel?.stream;

      if (!stream?.is_live) {
        log.info("stream ended before preview became available", { channel_name: channelName });
        return null;
      }

      if (stream.thumbnail && await isKickStreamPreviewAvailable(stream.thumbnail)) {
        return stream.thumbnail;
      }
    } catch (error) {
      log.warn("failed to fetch stream while waiting for preview", { channel_name: channelName, error });
    }

    await sleep(STREAM_PREVIEW_RETRY_MS);
  }
}
