import { getStreamsByUserIds } from "../twitchAPI/users";
import { getKickChannelsOnline } from "../kickAPI/users";
import type { Platform } from "../database/schema";
import logger from "../logger";

const log = logger.getSubLogger({ name: "services:online" });

export type OnlineState = "online" | "offline" | "unknown";

export interface LiveStatus {
  state: OnlineState;
  title?: string;
  viewers?: number;
  category?: string;
  startedAt?: string;
  /** When this status was fetched from the provider. */
  checkedAt: string;
}

export interface LiveTarget {
  platform: Platform;
  channelId: number;
  login: string;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; status: LiveStatus }>();

export function liveKey(platform: Platform, channelId: number): string {
  return `${platform}:${channelId}`;
}

function unknownStatus(checkedAt: string): LiveStatus {
  return { state: "unknown", checkedAt };
}

function readCache(key: string): LiveStatus | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.status;
}

function writeCache(key: string, status: LiveStatus): void {
  cache.set(key, { at: Date.now(), status });
}

/**
 * Batches provider lookups: one Twitch request for all ids, one Kick request
 * for all slugs. Results are cached briefly (30s) so cards do not hit the
 * provider on every render. A provider failure yields `unknown`, never
 * `offline`.
 */
export async function getLiveStatuses(targets: LiveTarget[]): Promise<Record<string, LiveStatus>> {
  const checkedAt = new Date().toISOString();
  const result: Record<string, LiveStatus> = {};
  const pending: LiveTarget[] = [];

  for (const target of targets) {
    const key = liveKey(target.platform, target.channelId);
    const cached = readCache(key);
    if (cached) {
      result[key] = cached;
    } else {
      pending.push(target);
    }
  }

  const twitchTargets = pending.filter((t) => t.platform === "twitch");
  const kickTargets = pending.filter((t) => t.platform === "kick");

  await Promise.all([
    (async () => {
      if (twitchTargets.length === 0) return;
      try {
        const streams = await getStreamsByUserIds(twitchTargets.map((t) => t.channelId));
        const byId = new Map(streams.map((s) => [Number(s.user_id), s]));
        for (const target of twitchTargets) {
          const stream = byId.get(target.channelId);
          const status: LiveStatus = stream
            ? {
                state: "online",
                title: stream.title,
                viewers: stream.viewer_count,
                category: stream.game_name,
                startedAt: stream.started_at,
                checkedAt,
              }
            : { state: "offline", checkedAt };
          result[liveKey(target.platform, target.channelId)] = status;
          writeCache(liveKey(target.platform, target.channelId), status);
        }
      } catch (error) {
        log.warn("failed to fetch twitch live status", { error });
        for (const target of twitchTargets) {
          result[liveKey(target.platform, target.channelId)] = unknownStatus(checkedAt);
        }
      }
    })(),
    (async () => {
      if (kickTargets.length === 0) return;
      try {
        const channels = await getKickChannelsOnline(kickTargets.map((t) => t.login));
        const bySlug = new Map(channels.map((c) => [c.slug.toLowerCase(), c]));
        for (const target of kickTargets) {
          const channel = bySlug.get(target.login.toLowerCase());
          if (!channel) {
            result[liveKey(target.platform, target.channelId)] = unknownStatus(checkedAt);
            continue;
          }
          const status: LiveStatus = channel.is_live
            ? {
                state: "online",
                title: channel.stream_title,
                viewers: channel.viewer_count,
                category: channel.category?.name,
                checkedAt,
              }
            : { state: "offline", checkedAt };
          result[liveKey(target.platform, target.channelId)] = status;
          writeCache(liveKey(target.platform, target.channelId), status);
        }
      } catch (error) {
        log.warn("failed to fetch kick live status", { error });
        for (const target of kickTargets) {
          result[liveKey(target.platform, target.channelId)] = unknownStatus(checkedAt);
        }
      }
    })(),
  ]);

  return result;
}

export async function getLiveStatus(target: LiveTarget): Promise<LiveStatus> {
  const statuses = await getLiveStatuses([target]);
  return statuses[liveKey(target.platform, target.channelId)] ?? unknownStatus(new Date().toISOString());
}

/** Test helper: clears the in-memory cache. */
export function clearLiveStatusCache(): void {
  cache.clear();
}
