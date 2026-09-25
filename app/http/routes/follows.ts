import { Elysia, t } from "elysia";
import { getFollowsWithChannelByUserId, getFollowsWithChannelPage } from "../../database/db";
import type { Platform } from "../../database/schema";
import { verifyChannelById } from "../../services/channels";
import { ServiceError } from "../../services/errors";
import { addFollowForUser, getChannelForFollow, getFollowForUser, removeFollowForUser } from "../../services/follows";
import { getLiveStatus, getLiveStatuses, liveKey } from "../../services/online";
import { BOT_USERNAME } from "../../config";
import { toLiveStatusDto, toFollowDto, PLATFORM_CAPABILITIES, type FollowDetailsDto, type FollowDto } from "../dto";
import { authPlugin, requireAuth } from "../auth/middleware";
import { decodeCursor, encodeCursor, parseLimit } from "../pagination";
import { isRateLimited } from "../limits";
import { followParamsSchema, platformSchema, type PlatformParam } from "../schemas";

const FOLLOW_PAGE_EXPORT_LIMIT = 500;
function startParamFor(platform: Platform, login: string): string {
  return `prefollow_${platform}_${login}`;
}

function shareUrlFor(startParam: string): string | null {
  if (!BOT_USERNAME) return null;
  const deepLink = `https://t.me/${BOT_USERNAME}?startapp=${encodeURIComponent(startParam)}`;
  return `https://t.me/share/url?url=${encodeURIComponent(deepLink)}`;
}

export const followRoutes = new Elysia()
  .use(authPlugin)
  .get("/follows", async ({ auth, query, set }) => {
    const userId = requireAuth(auth).userId;
    const limit = parseLimit(query.limit);
    const offset = decodeCursor(query.cursor);
    const platform = (query.platform === "twitch" || query.platform === "kick")
      ? query.platform as Platform
      : undefined;

    const rows = await getFollowsWithChannelPage(userId, {
      platform,
      search: query.search ?? undefined,
      limit,
      offset,
    });

    const lives = await getLiveStatuses(rows.map((row) => ({
      platform: row.platform,
      channelId: row.channel_id,
      login: row.channel_login,
    })));

    const items: FollowDto[] = rows.map((row) => toFollowDto({
      platform: row.platform,
      channelId: row.channel_id,
      login: row.channel_login,
      displayName: row.channel_name,
      followDate: row.created,
      live: lives[liveKey(row.platform, row.channel_id)],
    }));

    set.headers["cache-control"] = "no-store";
    return {
      items,
      nextCursor: rows.length === limit ? encodeCursor(offset + limit) : null,
    };
  }, {
    query: t.Object({
      platform: t.Optional(t.String()),
      search: t.Optional(t.String({ maxLength: 64 })),
      cursor: t.Optional(t.String({ maxLength: 64 })),
      limit: t.Optional(t.String({ maxLength: 8 })),
    }),
  })
  .post("/follows", async ({ auth, body, request, set }) => {
    if (isRateLimited(request)) {
      throw new ServiceError("RATE_LIMITED", "Too many requests");
    }
    const userId = requireAuth(auth).userId;
    const platform = body.platform as PlatformParam;

    const channel = await verifyChannelById(platform, body.channelId, body.login ?? null);
    const { follow, isNew } = await addFollowForUser(userId, channel);
    const live = await getLiveStatus({
      platform: channel.platform,
      channelId: channel.channelId,
      login: channel.login,
    });

    set.headers["cache-control"] = "no-store";
    return {
      isNew,
      follow: toFollowDto({
        platform: channel.platform,
        channelId: channel.channelId,
        login: channel.login,
        displayName: channel.displayName,
        followDate: follow.created,
        live,
      }),
    };
  }, {
    body: t.Object({
      platform: platformSchema,
      channelId: t.Union([t.String({ maxLength: 20 }), t.Number()]),
      login: t.Optional(t.String({ maxLength: 64 })),
    }),
  })
  .get("/follows/:platform/:channelId", async ({ auth, params, set }): Promise<FollowDetailsDto> => {
    const userId = requireAuth(auth).userId;
    const platform = params.platform as Platform;
    const channelId = Number(params.channelId);

    const follow = await getFollowForUser(userId, platform, channelId);
    if (!follow) {
      throw new ServiceError("NOT_FOUND", "Follow not found");
    }
    const channel = await getChannelForFollow(platform, channelId);
    if (!channel) {
      throw new ServiceError("NOT_FOUND", "Channel not found");
    }

    const live = await getLiveStatus({ platform, channelId, login: channel.channel_login });
    const startParam = startParamFor(platform, channel.channel_login);

    set.headers["cache-control"] = "no-store";
    return {
      ...toFollowDto({
        platform,
        channelId,
        login: channel.channel_login,
        displayName: channel.channel_name,
        followDate: follow.created,
        live,
      }),
      shareUrl: shareUrlFor(startParam),
      startParam,
    };
  }, { params: followParamsSchema })
  .delete("/follows/:platform/:channelId", async ({ auth, params, request, set }) => {
    if (isRateLimited(request)) {
      throw new ServiceError("RATE_LIMITED", "Too many requests");
    }
    const userId = requireAuth(auth).userId;
    const platform = params.platform as Platform;
    const channelId = Number(params.channelId);

    const { removed } = await removeFollowForUser(userId, platform, channelId);
    set.headers["cache-control"] = "no-store";
    return { removed };
  }, { params: followParamsSchema })
  .get("/follows/:platform/:channelId/live", async ({ auth, params, set }) => {
    const userId = requireAuth(auth).userId;
    const platform = params.platform as Platform;
    const channelId = Number(params.channelId);

    const follow = await getFollowForUser(userId, platform, channelId);
    if (!follow) {
      throw new ServiceError("NOT_FOUND", "Follow not found");
    }
    const channel = await getChannelForFollow(platform, channelId);
    if (!channel) {
      throw new ServiceError("NOT_FOUND", "Channel not found");
    }

    const live = await getLiveStatus({ platform, channelId, login: channel.channel_login });
    set.headers["cache-control"] = "no-store";
    return {
      platform,
      channelId: String(channelId),
      login: channel.channel_login,
      displayName: channel.channel_name,
      url: platform === "twitch"
        ? `https://twitch.tv/${channel.channel_login}`
        : `https://kick.com/${channel.channel_login}`,
      capabilities: PLATFORM_CAPABILITIES[platform],
      ...toLiveStatusDto(live),
    };
  }, { params: followParamsSchema })
  .get("/online", async ({ auth, set }) => {
    const userId = requireAuth(auth).userId;
    const rows = await getFollowsWithChannelByUserId(userId);
    const limited = rows.slice(0, FOLLOW_PAGE_EXPORT_LIMIT);

    const lives = await getLiveStatuses(limited.map((row) => ({
      platform: row.platform,
      channelId: row.channel_id,
      login: row.channel_login,
    })));

    const items = limited
      .map((row) => toFollowDto({
        platform: row.platform,
        channelId: row.channel_id,
        login: row.channel_login,
        displayName: row.channel_name,
        followDate: row.created,
        live: lives[liveKey(row.platform, row.channel_id)],
      }))
      .filter((item) => item.online === "online");

    set.headers["cache-control"] = "no-store";
    return { items, checkedAt: new Date().toISOString() };
  });
