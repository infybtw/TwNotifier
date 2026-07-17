import { Composer } from "grammy";
import logger from "../logger";
import {
  checkOrCreateUser,
  getChannelByChannelId,
  getChannelsByUsername,
  getFollowByUserIdAndChannelId,
  getFollowByUserIdChannelIdAndPlatform,
  getFollowsByUserId,
  getFollowsByUserIdAndPlatform,
  getUserByUserId,
  makeUserAdmin
} from "../database/db";
import { getUserByLogin } from "../twitchAPI/users";
import {
  buildHomeKeyboard,
  buildAddConfirmationKeyboard,
  buildRemoveConfirmationKeyboard,
  buildAdminKeyboard,
  buildPlatformSelectKeyboard,
  buildRemovePlatformSelectKeyboard,
  buildAdminBackKeyboard,
  buildBroadcastConfirmKeyboard,
  buildBackHomeKeyboard,
  buildMySubscriptionsAddBackKeyboard,
} from "./keyboards";
import { extractUsernameFromTwitchUrl } from "../utils/urlParser";
import { MyContext } from "./bot";
import { getKickChannelByUsername } from "../kickAPI/users";
import { Channel, UserFollow } from "../database/schema";
import { t, Locale } from "../i18n";
import { getUserLocale } from "../utils/locale";
import { formatDateUTC } from "../utils/time";

const log = logger.getSubLogger({ name: "bot:router" });

export const router = new Composer<MyContext>();

router.command("start", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  ctx.reply(t("start.welcome", locale), { reply_markup: await buildHomeKeyboard(ctx.from?.id!, locale), parse_mode: "HTML" });
  const newUser = await checkOrCreateUser(ctx.from?.id!, ctx.from?.username!, ctx.from?.first_name!)
  if (!newUser) {
    ctx.reply(t("commands.registration_error", locale))
  } else if(!newUser.isNew) {
    log.info("used /start", { userId: ctx.message?.from.id, username: ctx.from?.username, first_name: ctx.from?.first_name});
  } else if (newUser.isNew) {
    log.info("user registered", { userId: ctx.message?.from.id, username: ctx.from?.username, first_name: ctx.from?.first_name });
  }
});

router.command("add", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  const input = ctx.match.trim();

  if (!input) {
    return ctx.reply(t("commands.add_usage", locale));
  }

  const extractedUsername = extractUsernameFromTwitchUrl(input);
  if (!extractedUsername) {
    return ctx.reply(t("commands.url_parse_error", locale));
  }

  const channel_name_lower = extractedUsername.toLowerCase();
  const twitchChannel = await getUserByLogin(channel_name_lower);
  const kickChannel = await getKickChannelByUsername(channel_name_lower);
  if (!(twitchChannel || kickChannel)) {
    return ctx.reply(t("commands.channel_not_found", locale));
  }

  if (kickChannel.data[0] && twitchChannel) {
    ctx.session.pendingPlatformSelect = {
      kickData: kickChannel,
      twitchData: twitchChannel,
    }

    const message = t("add.dual_platform", locale)
      .replace("{kickUrl}", `https://kick.com/${channel_name_lower}`)
      .replace("{twitchUrl}", `https://twitch.tv/${channel_name_lower}`);

    return ctx.reply(message, { reply_markup: buildPlatformSelectKeyboard(locale) })
  }
  let platform = ""
  if (kickChannel.data[0]) {
    const channel_id = Number(kickChannel.data[0].broadcaster_user_id);
    const display_name = kickChannel.data[0].slug;

    if (!ctx.from) {
      return ctx.reply(t("commands.user_error", locale));
    }

    if (await getFollowByUserIdAndChannelId(ctx.from.id, channel_id)) {
      return ctx.reply(t("commands.already_following", locale).replace("{name}", display_name));
    }

    ctx.session.pendingAdd = {
      channelId: channel_id,
      channelName: channel_name_lower,
      displayName: display_name,
      platform: "kick"
    };

    const previewMessage = t("add.preview", locale)
      .replace("{name}", display_name)
      .replace("{url}", `https://kick.com/${display_name}`);

    log.info("showing channel preview", {
      userId: ctx.from.id,
      channel: display_name,
      channelId: channel_id,
      platform: "kick"
    });

    return await ctx.reply(previewMessage, {
      reply_markup: buildAddConfirmationKeyboard(locale),
    });
  } else if (twitchChannel) {
      const channel_id = Number(twitchChannel!.id);
      const display_name = twitchChannel!.display_name;

      if (!ctx.from) {
        return ctx.reply(t("commands.user_error", locale));
      }

      if (await getFollowByUserIdAndChannelId(ctx.from.id, channel_id)) {
        return ctx.reply(t("commands.already_following", locale).replace("{name}", display_name));
      }

      ctx.session.pendingAdd = {
        channelId: channel_id,
        channelName: channel_name_lower,
        displayName: display_name,
        platform: "twitch"
      };

      const previewMessage = t("add.preview", locale)
        .replace("{name}", display_name)
        .replace("{url}", `https://twitch.tv/${display_name}`);

      await ctx.reply(previewMessage, {
        reply_markup: buildAddConfirmationKeyboard(locale),
      });

      log.info("showing channel preview", {
        userId: ctx.from.id,
        channel: display_name,
        channelId: channel_id,
        platform: "twitch",
      });
  } else {
    return ctx.reply(t("commands.channel_not_found", locale))
  }
});

router.command("remove", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  const input = ctx.match.trim();

  if (!input) {
    return ctx.reply(t("commands.remove_usage", locale));
  }

  const extractedUsername = extractUsernameFromTwitchUrl(input);
  if (!extractedUsername) {
    return ctx.reply(t("commands.url_parse_error", locale));
  }

  if (!ctx.from) {
    return ctx.reply(t("commands.user_error", locale));
  }

  const channel_name_lower = extractedUsername.toLowerCase();
  const usernameChannels = await getChannelsByUsername(channel_name_lower)

  const kickChannel = usernameChannels.find(ch => ch.platform === "kick")
  const twitchChannel = usernameChannels.find(ch => ch.platform === "twitch")

  if (!kickChannel && !twitchChannel) {
    return ctx.reply(t("commands.channel_not_found", locale));
  }

  const kickFollow = kickChannel ? await getFollowByUserIdChannelIdAndPlatform(ctx.from?.id, kickChannel.channel_id!, "kick") : undefined
  const twitchFollow = twitchChannel ? await getFollowByUserIdChannelIdAndPlatform(ctx.from?.id, twitchChannel.channel_id!, "twitch") : undefined

  let bothFollow: boolean = false
  let follow: UserFollow
  let channel: Channel

  if (kickFollow && twitchFollow) {
    bothFollow = true
  } else if (kickFollow || twitchFollow){
    if (kickFollow) {
      follow = kickFollow
      channel = kickChannel!
    } else {
      follow = twitchFollow!
      channel = twitchChannel!
    }
  } else {
    return ctx.reply(t("commands.not_following", locale))
  }

  if (usernameChannels.length < 1) {
    return ctx.reply(t("commands.channel_not_found", locale));
  }

  if (usernameChannels.length > 1 && bothFollow) {
    if (!kickChannel || !twitchChannel) {
      return ctx.reply(t("commands.channel_not_found", locale))
    } else {
      const message = t("remove.dual_platform", locale)
        .replace("{kickUrl}", `https://kick.com/${channel_name_lower}`)
        .replace("{twitchUrl}", `https://twitch.tv/${channel_name_lower}`);

      ctx.session.removePendingPlatformSelect = {
        kickChannel,
        twitchChannel,
      }
      return ctx.reply(message, { reply_markup: buildRemovePlatformSelectKeyboard(locale) })
    }
  }

  const channelPlatform = follow!.platform === "twitch" ? "twitch" : "kick";
  const channelPlatformUrl = follow!.platform === "twitch" ? "twitch.tv" : "kick.com";

  const channel_id = Number(channel!.channel_id);
  const display_name = channel!.channel_name || extractedUsername;



  if (!(await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, channelPlatform))) {
    return ctx.reply(t("commands.not_following_name", locale).replace("{name}", display_name));
  }

  ctx.session.pendingRemove = {
    channelId: channel_id,
    channelName: channel_name_lower,
    displayName: display_name,
    platform: channelPlatform,
  };

  const previewMessage = t("remove.preview", locale)
    .replace("{name}", display_name)
    .replace("{url}", `https://${channelPlatformUrl}/${channel_name_lower}`);

  await ctx.reply(previewMessage, {
    reply_markup: buildRemoveConfirmationKeyboard(locale),
  });

  log.info("showing remove preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id,
  });
});

router.command("list", async (ctx) => {
  const locale = await getUserLocale(ctx.from?.id!);
  const user_id = ctx.from?.id
  const kickFollows = await getFollowsByUserIdAndPlatform(user_id!, "kick")
  const twitchFollows = await getFollowsByUserIdAndPlatform(user_id!, "twitch")
  if (kickFollows.length < 1 && twitchFollows.length < 1) {
    return ctx.reply(t("commands.list_empty", locale), { parse_mode: "HTML" });
  }
  const total = kickFollows.length + twitchFollows.length
  let reply_text = t("commands.list_header", locale).replace("{total}", String(total))
  if (twitchFollows.length >= 1) {
    reply_text += `\n\n🟣 <b>Twitch</b>\n`
    for (const sub of twitchFollows) {
        const channel = await getChannelByChannelId(sub.channel_id!);
        reply_text += `   📺 ${channel?.channel_name || `ID:${sub.channel_id}`}\n`
        reply_text += `      📅 ${formatDateUTC(sub.created)}\n`;
    }
  }
  if (kickFollows.length >= 1) {
    reply_text += `\n\n🟢 <b>Kick</b>\n`
    for (const sub of kickFollows) {
        const channel = await getChannelByChannelId(sub.channel_id!);
        reply_text += `   📺 ${channel?.channel_name || `ID:${sub.channel_id}`}\n`
        reply_text += `      📅 ${formatDateUTC(sub.created)}\n`;
    }
  }

  ctx.reply(reply_text.trimEnd(), {parse_mode: "HTML", reply_markup: buildBackHomeKeyboard(locale)});
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
  const message = t("admin.panel", locale).replace("{name}", firstName)
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
    const locale = await getUserLocale(ctx.from?.id!);
    const input = ctx.message.text.trim();

    const extractedUsername = extractUsernameFromTwitchUrl(input);
    if (!extractedUsername) {
      return ctx.reply(
        t("commands.url_parse_error", locale),
        { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) },
      );
    }

    const channel_name_lower = extractedUsername.toLowerCase();
    const twitchChannel = await getUserByLogin(channel_name_lower);
    const kickChannel = await getKickChannelByUsername(channel_name_lower);
    if (!(twitchChannel || kickChannel)) {
      return ctx.reply(t("commands.channel_not_found", locale), { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) });
    }

    if (kickChannel.data[0] && twitchChannel) {
      ctx.session.pendingPlatformSelect = {
        kickData: kickChannel,
        twitchData: twitchChannel,
      }

      const message = t("add.dual_platform", locale)
        .replace("{kickUrl}", `https://kick.com/${channel_name_lower}`)
        .replace("{twitchUrl}", `https://twitch.tv/${channel_name_lower}`);

      return ctx.reply(message, { reply_markup: buildPlatformSelectKeyboard(locale) })
    }

    if (kickChannel.data[0]) {
      const channel_id = Number(kickChannel.data[0].broadcaster_user_id);
      const display_name = kickChannel.data[0].slug;

      if (!ctx.from) {
        return ctx.reply(t("commands.user_error", locale));
      }

      if (await getFollowByUserIdAndChannelId(ctx.from.id, channel_id)) {
        return ctx.reply(t("commands.already_following", locale).replace("{name}", display_name), { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) });
      }

      ctx.session.pendingAdd = {
        channelId: channel_id,
        channelName: channel_name_lower,
        displayName: display_name,
        platform: "kick"
      };

      const previewMessage = t("add.preview", locale)
        .replace("{name}", display_name)
        .replace("{url}", `https://kick.com/${display_name}`);

      log.info("showing channel preview", {
        userId: ctx.from.id,
        channel: display_name,
        channelId: channel_id,
        platform: "kick"
      });

      return await ctx.reply(previewMessage, {
        reply_markup: buildAddConfirmationKeyboard(locale),
      });
    } else if (twitchChannel) {
      const channel_id = Number(twitchChannel!.id);
      const display_name = twitchChannel!.display_name;

      if (!ctx.from) {
        return ctx.reply(t("commands.user_error", locale));
      }

      if (await getFollowByUserIdAndChannelId(ctx.from.id, channel_id)) {
        return ctx.reply(t("commands.already_following", locale).replace("{name}", display_name), { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) });
      }

      ctx.session.pendingAdd = {
        channelId: channel_id,
        channelName: channel_name_lower,
        displayName: display_name,
        platform: "twitch"
      };

      const previewMessage = t("add.preview", locale)
        .replace("{name}", display_name)
        .replace("{url}", `https://twitch.tv/${display_name}`);

      log.info("showing channel preview", {
        userId: ctx.from.id,
        channel: display_name,
        channelId: channel_id,
        platform: "twitch",
      });

      return await ctx.reply(previewMessage, {
        reply_markup: buildAddConfirmationKeyboard(locale),
      });
    } else {
      return ctx.reply(t("commands.channel_not_found", locale), { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) });
    }
  }

  if (ctx.session.awaitingRemoveInput && ctx.message.text) {
    ctx.session.awaitingRemoveInput = undefined;
    const locale = await getUserLocale(ctx.from?.id!);
    const input = ctx.message.text.trim();

    const extractedUsername = extractUsernameFromTwitchUrl(input);
    if (!extractedUsername) {
      return ctx.reply(
        t("commands.url_parse_error", locale),
        { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) },
      );
    }

    if (!ctx.from) {
      return ctx.reply(t("commands.user_error", locale));
    }

    const channel_name_lower = extractedUsername.toLowerCase();
    const usernameChannels = await getChannelsByUsername(channel_name_lower)

    const kickChannel = usernameChannels.find(ch => ch.platform === "kick")
    const twitchChannel = usernameChannels.find(ch => ch.platform === "twitch")

    if (!kickChannel && !twitchChannel) {
      return ctx.reply(t("commands.channel_not_found", locale), { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) });
    }

    const kickFollow = kickChannel ? await getFollowByUserIdChannelIdAndPlatform(ctx.from?.id, kickChannel.channel_id!, "kick") : undefined
    const twitchFollow = twitchChannel ? await getFollowByUserIdChannelIdAndPlatform(ctx.from?.id, twitchChannel.channel_id!, "twitch") : undefined

    let bothFollow: boolean = false
    let follow: UserFollow
    let channel: Channel

    if (kickFollow && twitchFollow) {
      bothFollow = true
    } else if (kickFollow || twitchFollow){
      if (kickFollow) {
        follow = kickFollow
        channel = kickChannel!
      } else {
        follow = twitchFollow!
        channel = twitchChannel!
      }
    } else {
      return ctx.reply(t("commands.not_following", locale), { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) });
    }

    if (usernameChannels.length < 1) {
      return ctx.reply(t("commands.channel_not_found", locale), { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) });
    }

    if (usernameChannels.length > 1 && bothFollow) {
      if (!kickChannel || !twitchChannel) {
        return ctx.reply(t("commands.channel_not_found", locale), { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) });
      } else {
        const message = t("remove.dual_platform", locale)
          .replace("{kickUrl}", `https://kick.com/${channel_name_lower}`)
          .replace("{twitchUrl}", `https://twitch.tv/${channel_name_lower}`);

        ctx.session.removePendingPlatformSelect = {
          kickChannel,
          twitchChannel,
        }
        return ctx.reply(message, { reply_markup: buildRemovePlatformSelectKeyboard(locale) })
      }
    }

    const channelPlatform = follow!.platform === "twitch" ? "twitch" : "kick";
    const channelPlatformUrl = follow!.platform === "twitch" ? "twitch.tv" : "kick.com";

    const channel_id = Number(channel!.channel_id);
    const display_name = channel!.channel_name || extractedUsername;

    if (!(await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, channelPlatform))) {
      return ctx.reply(t("commands.not_following_name", locale).replace("{name}", display_name), { reply_markup: buildMySubscriptionsAddBackKeyboard(locale) });
    }

    ctx.session.pendingRemove = {
      channelId: channel_id,
      channelName: channel_name_lower,
      displayName: display_name,
      platform: channelPlatform,
    };

    const previewMessage = t("remove.preview", locale)
      .replace("{name}", display_name)
      .replace("{url}", `https://${channelPlatformUrl}/${channel_name_lower}`);

    await ctx.reply(previewMessage, {
      reply_markup: buildRemoveConfirmationKeyboard(locale),
    });

    log.info("showing remove preview", {
      userId: ctx.from.id,
      channel: display_name,
      channelId: channel_id,
    });
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
    return ctx.reply(t("admin.broadcast_error", locale), { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "Markdown" });
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
