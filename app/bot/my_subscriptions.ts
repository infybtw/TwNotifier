import { InlineKeyboard } from "grammy";
import { getFollowsWithChannelByUserId } from "../database/db";
import { getStreamsByUserIds } from "../twitchAPI/users";
import { getKickChannelsOnline } from "../kickAPI/users";
import logger from "../logger";
import { t, Locale } from "../i18n";
import { buildMySubscriptionsKeyboard, followOnlineKey } from "./keyboards";

const log = logger.getSubLogger({ name: "bot:my_subscriptions" });

type FollowWithChannel = Awaited<ReturnType<typeof getFollowsWithChannelByUserId>>[number];

export interface MySubscriptionsView {
  text: string;
  keyboard: InlineKeyboard;
}

async function getOnlineKeys(follows: FollowWithChannel[]): Promise<Set<string>> {
  const onlineKeys = new Set<string>();
  const twitchIds = follows
    .filter((f) => f.platform === "twitch" && f.channel_id != null)
    .map((f) => Number(f.channel_id));
  const kickNames = follows
    .filter((f) => f.platform === "kick" && f.channel_name)
    .map((f) => f.channel_name!.toLowerCase());

  const [streams, kickChannels] = await Promise.all([
    twitchIds.length > 0
      ? getStreamsByUserIds(twitchIds).catch((err) => {
          log.warn("failed to fetch twitch online status", { error: err });
          return [];
        })
      : Promise.resolve([]),
    kickNames.length > 0
      ? getKickChannelsOnline(kickNames).catch((err) => {
          log.warn("failed to fetch kick online status", { error: err });
          return [];
        })
      : Promise.resolve([]),
  ]);

  for (const stream of streams) onlineKeys.add(`twitch:${stream.user_id}`);
  for (const channel of kickChannels) {
    if (channel.is_live) onlineKeys.add(`kick:${channel.slug.toLowerCase()}`);
  }
  return onlineKeys;
}

export async function buildMySubscriptionsView(
  user_id: number,
  page: number = 0,
  locale: Locale = "ru",
): Promise<MySubscriptionsView | null> {
  const follows = await getFollowsWithChannelByUserId(user_id);
  if (follows.length < 1) return null;

  const onlineKeys = await getOnlineKeys(follows);
  const onlineCount = follows.filter((f) =>
    onlineKeys.has(followOnlineKey(f.platform, f.channel_id!, f.channel_name)),
  ).length;

  const text = t("subscriptions.page_header", locale)
    .replace("{total}", String(follows.length))
    .replace("{online}", String(onlineCount));

  return { text, keyboard: buildMySubscriptionsKeyboard(follows, page, locale, onlineKeys) };
}
