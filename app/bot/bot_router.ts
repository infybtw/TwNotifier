import { Composer, InlineKeyboard } from "grammy";
import logger from "../logger";
import { getChannelsByLogin, getUserByUserId, makeUserAdmin } from "../database/db";
import {
  buildHomeKeyboard,
  buildAdminKeyboard,
  buildPlatformSelectKeyboard,
  buildRemovePlatformSelectKeyboard,
  buildBroadcastConfirmKeyboard,
  buildMySubscriptionsAddBackKeyboard,
} from "./keyboards";
import { buildMySubscriptionsView } from "./my_subscriptions";
import { parseChannelInput } from "../utils/urlParser";
import { MyContext } from "./bot";
import { t } from "../i18n";
import { getUserLocale } from "../utils/locale";
import { STARTUP_TIME } from "../config";
import { formatUptime } from "../utils/time";
import { registerUser, markChatDeliveryEnabled } from "../services/users";
import { resolveChannelCandidates, type ResolvedChannel } from "../services/channels";
import { addFollowForUser, getFollowForUser } from "../services/follows";
import {
  buildAddPreview,
  buildRemovePreview,
  buildDualPlatformMessage,
  buildDualPlatformRemoveMessage,
  channelToPending,
  type PendingChannel,
} from "./follow_flow";

const log = logger.getSubLogger({ name: "bot:router" });

export const router = new Composer<MyContext>();

async function handleAddInput(ctx: MyContext, input: string, backKeyboard?: InlineKeyboard): Promise<unknown> {
  const locale = await getUserLocale(ctx.from!.id);
  const resolved = await resolveChannelCandidates(input);
  if (!resolved) {
    return ctx.reply(t("commands.url_parse_error", locale), { reply_markup: backKeyboard });
  }

  if (resolved.channels.length === 0) {
    if (resolved.unavailablePlatforms.length > 0) {
      return ctx.reply(t("add.error", locale), { parse_mode: "HTML", reply_markup: backKeyboard });
    }
    return ctx.reply(t("commands.channel_not_found", locale), { reply_markup: backKeyboard });
  }

  const notFollowed: ResolvedChannel[] = [];
  for (const channel of resolved.channels) {
    const existing = await getFollowForUser(ctx.from!.id, channel.platform, channel.channelId);
    if (!existing) notFollowed.push(channel);
  }

  if (notFollowed.length === 0) {
    const name = resolved.channels[0].displayName;
    return ctx.reply(t("commands.already_following", locale).replace("{name}", name), {
      parse_mode: "HTML",
      reply_markup: backKeyboard,
    });
  }

  if (notFollowed.length > 1) {
    ctx.session.pendingPlatformSelect = notFollowed;
    return ctx.reply(buildDualPlatformMessage(resolved.username, locale), {
      reply_markup: buildPlatformSelectKeyboard(locale),
    });
  }

  const channel = notFollowed[0];
  ctx.session.pendingAdd = channel;
  const preview = buildAddPreview(channel, locale);
  log.info("showing channel preview", {
    userId: ctx.from!.id,
    channel: channel.displayName,
    channelId: channel.channelId,
    platform: channel.platform,
  });
  await ctx.reply(preview.text, { reply_markup: preview.keyboard, parse_mode: "HTML" });
}

async function handleRemoveInput(ctx: MyContext, input: string, backKeyboard?: InlineKeyboard): Promise<unknown> {
  const locale = await getUserLocale(ctx.from!.id);
  const parsed = parseChannelInput(input);
  if (!parsed) {
    return ctx.reply(t("commands.url_parse_error", locale), { reply_markup: backKeyboard });
  }

  const allChannels = await getChannelsByLogin(parsed.username);
  if (allChannels.length === 0) {
    return ctx.reply(t("commands.channel_not_found", locale), { reply_markup: backKeyboard });
  }

  const candidates = parsed.platform
    ? allChannels.filter((channel) => channel.platform === parsed.platform)
    : allChannels;

  const followed: PendingChannel[] = [];
  for (const channel of candidates) {
    const follow = await getFollowForUser(ctx.from!.id, channel.platform, channel.channel_id);
    if (follow) followed.push(channelToPending(channel));
  }

  if (followed.length === 0) {
    return ctx.reply(t("commands.not_following", locale), { reply_markup: backKeyboard });
  }

  if (followed.length > 1) {
    ctx.session.removePendingPlatformSelect = followed;
    return ctx.reply(buildDualPlatformRemoveMessage(parsed.username, locale), {
      reply_markup: buildRemovePlatformSelectKeyboard(locale),
    });
  }

  const channel = followed[0];
  ctx.session.pendingRemove = channel;
  const preview = buildRemovePreview(channel, locale);
  log.info("showing remove preview", {
    userId: ctx.from!.id,
    channel: channel.displayName,
    channelId: channel.channelId,
    platform: channel.platform,
  });
  await ctx.reply(preview.text, { reply_markup: preview.keyboard, parse_mode: "HTML" });
}

router.command("start", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  const registration = await registerUser(ctx.from?.id!, ctx.from?.username ?? null, ctx.from?.first_name ?? null);
  if (!registration) {
    return ctx.reply(t("commands.registration_error", locale));
  }
  await markChatDeliveryEnabled(ctx.from!.id);

  const prefollowMatch = ctx.match.trim().match(/^prefollow_(twitch|kick)_([a-zA-Z0-9_-]{1,25})$/);
  if (prefollowMatch) {
    const platform = prefollowMatch[1] as "twitch" | "kick";
    const login = prefollowMatch[2].toLowerCase();
    const url = platform === "twitch" ? `https://twitch.tv/${login}` : `https://kick.com/${login}`;
    const resolved = await resolveChannelCandidates(url);
    const channel = resolved?.channels[0];

    if (!channel) {
      if (resolved && resolved.unavailablePlatforms.length > 0) {
        await ctx.reply(t("add.error", locale), { parse_mode: "HTML" });
      } else {
        await ctx.reply(t("commands.channel_not_found", locale));
      }
    } else {
      try {
        const { isNew } = await addFollowForUser(ctx.from!.id, channel);
        if (isNew) {
          await ctx.reply(t("add.success", locale).replace("{name}", channel.displayName), { parse_mode: "HTML" });
          log.info("new follow from start link", { userId: ctx.from!.id, channel: channel.displayName, platform: channel.platform });
        } else {
          await ctx.reply(t("add.already_exists", locale).replace("{name}", channel.displayName), { parse_mode: "HTML" });
        }
      } catch (error) {
        log.error("prefollow failed", { userId: ctx.from!.id, platform, login, error });
        await ctx.reply(t("add.error", locale), { parse_mode: "HTML" });
      }
    }
  }

  await ctx.reply(t("start.welcome", locale), { reply_markup: await buildHomeKeyboard(ctx.from!.id, locale), parse_mode: "HTML" });
  if (!registration.isNew) {
    log.info("used /start", { userId: ctx.message?.from.id, username: ctx.from?.username, first_name: ctx.from?.first_name });
  } else {
    log.info("user registered", { userId: ctx.message?.from.id, username: ctx.from?.username, first_name: ctx.from?.first_name });
  }
});

router.command("add", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  const input = ctx.match.trim();
  if (!input) {
    return ctx.reply(t("commands.add_usage", locale));
  }
  return handleAddInput(ctx, input);
});

router.command("remove", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  const input = ctx.match.trim();
  if (!input) {
    return ctx.reply(t("commands.remove_usage", locale));
  }
  return handleRemoveInput(ctx, input);
});

router.command("list", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  const view = await buildMySubscriptionsView(ctx.from!.id, 0, locale);
  if (!view) {
    return ctx.reply(t("commands.list_empty", locale), { parse_mode: "HTML" });
  }
  return ctx.reply(view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
});

router.command("admin", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  const user = await getUserByUserId(ctx.from?.id!)
  if (!user?.is_admin) {
    ctx.reply(t("admin.access_denied", locale), {parse_mode: "HTML"})
    return
  }
  ctx.session.adminLogin = {
    signed_in: true
  }
  log.warn(`${ctx.from?.id!} enter admin system`)
  const firstName = ctx.from?.first_name || "Admin"
  const message = t("admin.panel", locale).replace("{name}", firstName).replace("{uptime}", formatUptime(STARTUP_TIME))
  ctx.reply(message, {reply_markup: buildAdminKeyboard(locale), parse_mode: "HTML"})
})

router.command("becomeAdmin", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  const user = await getUserByUserId(ctx.from?.id!)
  if (user?.is_admin) {
    return ctx.reply(t("admin.already_admin", locale), {parse_mode: "HTML"})
  }
  const key = ctx.match.trim();
  if (!key) {
    return
  }
  const user_id = ctx.from?.id!
  const updatedUser = await makeUserAdmin(user_id, key)
  if (updatedUser) {
    log.warn(`User ${user_id} become admin with ${key}`)
    return ctx.reply(t("admin.activated", locale), {parse_mode: "HTML"})
  }
})

router.on("message", async (ctx, next) => {
  if (ctx.session.awaitingAddInput && ctx.message.text) {
    ctx.session.awaitingAddInput = undefined;
    const input = ctx.message.text.trim();
    const locale = await getUserLocale(ctx.from?.id!);
    await handleAddInput(ctx, input, buildMySubscriptionsAddBackKeyboard(locale));
    return;
  }

  if (ctx.session.awaitingRemoveInput && ctx.message.text) {
    ctx.session.awaitingRemoveInput = undefined;
    const input = ctx.message.text.trim();
    const locale = await getUserLocale(ctx.from?.id!);
    await handleRemoveInput(ctx, input, buildMySubscriptionsAddBackKeyboard(locale));
    return;
  }

  return next();
});

router.on("message", async (ctx) => {
  if (!ctx.session.adminLogin || !ctx.session.broadcastPending) {
    return;
  }

  ctx.session.broadcastPending = undefined;

  const locale = await getUserLocale(ctx.from?.id!);
  const text = ctx.message?.text;
  const photo = ctx.message?.photo;
  const caption = ctx.message?.caption;

  if (!text && (!photo || photo.length === 0)) {
    return ctx.reply(t("admin.broadcast_error", locale), { reply_markup: buildAdminKeyboard(locale), parse_mode: "Markdown" });
  }

  const photoFileId = photo && photo.length > 0 ? photo[photo.length - 1].file_id : undefined;
  const messageText = text || caption;

  ctx.session.broadcastMessage = { text: messageText, photoFileId };

  let previewText = messageText || "";
  if (previewText.length > 500) {
    previewText = previewText.slice(0, 500) + "...";
  }
  let preview = t("admin.broadcast_preview", locale).replace("{text}", previewText);
  if (photoFileId && !messageText) {
    preview = t("admin.broadcast_preview", locale).replace("{text}", t("broadcast.photo_label", locale));
  } else if (photoFileId && messageText) {
    preview = t("admin.broadcast_preview", locale).replace("{text}", previewText + "\n\n" + t("broadcast.photo_label", locale));
  }

  await ctx.reply(preview, { reply_markup: buildBroadcastConfirmKeyboard(locale), parse_mode: "Markdown" });
});
