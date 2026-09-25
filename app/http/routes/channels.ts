import { Elysia, t } from "elysia";
import { resolveChannelCandidates } from "../../services/channels";
import { getFollowForUser } from "../../services/follows";
import { ServiceError } from "../../services/errors";
import { PLATFORM_CAPABILITIES, type ChannelMatchDto } from "../dto";
import { platformSchema, type PlatformParam } from "../schemas";
import { authPlugin, requireAuth } from "../auth/middleware";
import { isRateLimited } from "../limits";

export const channelRoutes = new Elysia()
  .use(authPlugin)
  .post("/channels/resolve", async ({ auth, body, request, set }) => {
    if (isRateLimited(request)) {
      throw new ServiceError("RATE_LIMITED", "Too many requests");
    }
    const userId = requireAuth(auth).userId;

    const resolved = await resolveChannelCandidates(body.query);
    if (!resolved) {
      throw new ServiceError("INVALID_INPUT", "Invalid channel name or URL");
    }

    const explicitPlatform = body.platform as PlatformParam | undefined;
    const channels = explicitPlatform
      ? resolved.channels.filter((channel) => channel.platform === explicitPlatform)
      : resolved.channels;

    const matches: ChannelMatchDto[] = [];
    for (const channel of channels) {
      const existing = await getFollowForUser(userId, channel.platform, channel.channelId);
      matches.push({
        platform: channel.platform,
        channelId: String(channel.channelId),
        login: channel.login,
        displayName: channel.displayName,
        url: channel.platform === "twitch"
          ? `https://twitch.tv/${channel.login}`
          : `https://kick.com/${channel.login}`,
        alreadyFollowing: Boolean(existing),
        capabilities: PLATFORM_CAPABILITIES[channel.platform],
      });
    }

    set.headers["cache-control"] = "no-store";
    return {
      username: resolved.username,
      platformHint: resolved.platformHint,
      unavailablePlatforms: resolved.unavailablePlatforms,
      matches,
    };
  }, {
    body: t.Object({
      query: t.String({ minLength: 1, maxLength: 256 }),
      platform: t.Optional(platformSchema),
    }),
  });
