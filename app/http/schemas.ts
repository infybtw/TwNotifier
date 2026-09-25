import { t } from "elysia";

export const platformSchema = t.Union([t.Literal("twitch"), t.Literal("kick")]);
export type PlatformParam = "twitch" | "kick";

export const followParamsSchema = t.Object({
  platform: platformSchema,
  channelId: t.String({ pattern: "^[0-9]+$" }),
});
