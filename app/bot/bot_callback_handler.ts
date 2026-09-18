import { Composer, InlineKeyboard } from "grammy";
import {
  buildSettingsKeyboard,
  buildHomeKeyboard,
  buildAdminKeyboard,
  buildAdminBackKeyboard,
  buildAddConfirmationKeyboard,
  buildBroadcastCancelKeyboard,
  buildBroadcastConfirmKeyboard,
  buildInfoBackKeyboard,
  buildEventsubControlKeyboard,
  buildEventsubResultKeyboard,
  buildWebhookControlKeyboard,
  buildWebhookResultKeyboard,
  buildAdminAddConfirmKeyboard,
  buildBackHomeKeyboard,
  buildMySubscriptionsEmptyKeyboard,
  buildFollowManagementKeyboard,
  buildMySubscriptionsAddBackKeyboard,
  buildRestartConfirmKeyboard,
  buildPlatformSelectKeyboard,
  buildRemovePlatformSelectKeyboard,
  buildRemoveConfirmationKeyboard,
  buildLanguageKeyboard,
  buildAdminSettingsKeyboard,
  buildTimezoneKeyboard,
  buildAdminUsersKeyboard,
  buildAdminChannelsKeyboard,
  buildAdminUserDetailKeyboard,
  buildAdminChannelDetailKeyboard,
  buildAdminAdminsKeyboard,
  buildAdminAdminDetailKeyboard,
  buildAdminKeysKeyboard,
  buildAdminKeyDetailKeyboard,
  buildAdminKeysBackKeyboard,
  buildAdminFollowsKeyboard,
  buildAdminFollowDetailKeyboard,
} from "./keyboards";
import { getAdminSettings, getUserByUserId, setAdminTimezoneOffset, setLanguageByUserId } from "../database/db";
import {
  addAdminKey,
  checkOrCreateChannel,
  checkOrCreateFollow,
  getAllAdminKeys,
  getAllFollowsWithDetails,
  getAdmins,
  getChannelByChannelId,
  getChannelFollowersByChannelIdAndPlatform,
  getChannels,
  getChannelsByPlatform,
  getChannelsWithFollowersByPlatform,
  getFollowByUserIdChannelIdAndPlatform,
  getFollowsByUserId,
  getFollowsByUserIdAndPlatform,
  getRecentStreamLogs,
  getUsersWithNotificationStatus,
  removeFollowByUserIdChannelIdAndPlatfrom,
  revokeAdminKey,
} from "../database/db";
import {
  deleteSubs,
  getEventSubList,
  subscribeAllStreamsOffline,
  subscribeAllStreamsOnline,
  subscribeAllChannelUpdates,
  subscribeToChannelOffline,
  subscribeToChannelOnline,
  subscribeToChannelUpdate,
} from "../twitchAPI/subscriptions";
import { getStreamsByUserIds } from "../twitchAPI/users";
import { getKickChannelsOnline } from "../kickAPI/users";
import logger from "../logger";
import { MyContext } from "./bot";
import { toggleLinkPreviewStateByUserId, toggleOfflineNotificationStateByUserId, toggleOnlineNotificationStateByUserId } from "../utils/settings";
import { randomBytes } from "node:crypto";
import { sleep } from "bun";
import { deleteKickSubscription, deleteKickSubscriptions, getKickSubscriptions, subscribeToKickChannelOnline, subscribeToKickChannelsOnline } from "../kickAPI/subscription";
import { sendBroadcastMessage } from "./bot_sender";
import { t, Locale } from "../i18n";
import { getUserLocale } from "../utils/locale";
import { TWITCH_EVENT_TRANSPORT, STARTUP_TIME } from "../config";
import { formatDateForAdmin, formatDateUTC, formatTimeForAdmin, formatUptime } from "../utils/time";
import { renderProgressBar } from "../utils/progress";
import { buildMySubscriptionsView } from "./my_subscriptions";

export const router = new Composer<MyContext>();

const log = logger.getSubLogger({ name: "bot:callback_handler" });

router.callbackQuery("settingsCMD", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  await ctx.editMessageText(t("settings.title", locale), {
    //@ts-ignore
    reply_markup: await buildSettingsKeyboard(ctx.from.id, locale),
    parse_mode: "HTML",
  });
});

router.callbackQuery("settingsBACK", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  await ctx.editMessageText(t("start.welcome", locale), { reply_markup: await buildHomeKeyboard(ctx.from.id, locale), parse_mode: "HTML" });
});

router.callbackQuery("adminCMD", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  const user = await getUserByUserId(ctx.from?.id!);
  if (!user?.is_admin) {
    return ctx.answerCallbackQuery({ text: t("admin.access_denied", locale), show_alert: true });
  }
  ctx.session.adminLogin = { signed_in: true };
  log.warn(`${ctx.from?.id} enter admin system`);
  const firstName = ctx.from?.first_name || "Admin";
  let message = t("admin.panel", locale).replace("{name}", firstName).replace("{uptime}", formatUptime(STARTUP_TIME));
  await ctx.editMessageText(message, { reply_markup: buildAdminKeyboard(locale), parse_mode: "HTML" });
});

async function renderMySubscriptionsPage(ctx: MyContext, page: number, locale: Locale) {
  const user_id = ctx.from?.id;
  const view = await buildMySubscriptionsView(user_id!, page, locale);
  if (!view) {
    await ctx.editMessageText(t("subscriptions.empty", locale), {
      parse_mode: "HTML",
      reply_markup: buildMySubscriptionsEmptyKeyboard(locale),
    });
    return;
  }
  await ctx.editMessageText(view.text, {
    parse_mode: "HTML",
    reply_markup: view.keyboard,
  });
}

router.callbackQuery("mySubscriptionsCMD", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  ctx.session.awaitingAddInput = undefined;
  ctx.session.awaitingRemoveInput = undefined;
  await renderMySubscriptionsPage(ctx, 0, locale);
});

router.callbackQuery(/^mySubscriptionsPage_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  await renderMySubscriptionsPage(ctx, Number(ctx.match[1]), locale);
});

router.callbackQuery("mySubscriptionsAdd", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  ctx.session.awaitingAddInput = true;
  await ctx.editMessageText(
    t("add.title", locale),
    { parse_mode: "HTML", reply_markup: buildMySubscriptionsAddBackKeyboard(locale) },
  );
});

router.callbackQuery("mySubscriptionsRemove", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  ctx.session.awaitingRemoveInput = true;
  await ctx.editMessageText(
    t("remove.title", locale),
    { parse_mode: "HTML", reply_markup: buildMySubscriptionsAddBackKeyboard(locale) },
  );
});

router.callbackQuery("mySubscriptionsOnline", async (ctx) => {
  await ctx.answerCallbackQuery();
  const locale = await getUserLocale(ctx.from.id);
  const user_id = ctx.from?.id;
  const kickFollows = await getFollowsByUserIdAndPlatform(user_id!, "kick");
  const twitchFollows = await getFollowsByUserIdAndPlatform(user_id!, "twitch");

  if (kickFollows.length < 1 && twitchFollows.length < 1) {
    try {
      await ctx.editMessageText(t("subscriptions.empty", locale), {
        parse_mode: "HTML",
        reply_markup: buildMySubscriptionsEmptyKeyboard(locale),
      });
    } catch {}
    return;
  }

  let onlineTwitch: { name: string; title: string; game: string; viewers: number }[] = [];
  let onlineKick: { name: string; title: string; viewers: number }[] = [];

  if (twitchFollows.length >= 1) {
    const twitchIds = twitchFollows.map((f) => Number(f.channel_id));
    const streams = await getStreamsByUserIds(twitchIds);
    for (const stream of streams) {
      onlineTwitch.push({
        name: stream.user_name,
        title: stream.title,
        game: stream.game_name,
        viewers: stream.viewer_count,
      });
    }
  }

  if (kickFollows.length >= 1) {
    const kickChannelNames: string[] = [];
    for (const f of kickFollows) {
      const ch = await getChannelByChannelId(f.channel_id!);
      if (ch?.channel_name) kickChannelNames.push(ch.channel_name);
    }
    const kickChannels = await getKickChannelsOnline(kickChannelNames);
    for (const ch of kickChannels) {
      if (ch.is_live) {
        onlineKick.push({
          name: ch.slug,
          title: ch.stream_title,
          viewers: ch.viewer_count,
        });
      }
    }
  }

  const backKb = new InlineKeyboard().text(t("buttons.back", locale), "settingsBACK");

  const totalOnline = onlineTwitch.length + onlineKick.length;
  if (totalOnline === 0) {
    try {
      await ctx.editMessageText(t("subscriptions.no_online", locale), {
        parse_mode: "HTML",
        reply_markup: backKb,
      });
    } catch {}
    return;
  }

  let text = t("subscriptions.online_header", locale);

  if (onlineTwitch.length >= 1) {
    text += `🟣 <b>Twitch</b>\n`;
    for (const s of onlineTwitch) {
      text += `   📺 <b><a href="https://twitch.tv/${s.name}">${s.name}</a></b> — 👁 ${s.viewers}\n`;
      text += `      🎮 ${s.game}\n`;
      text += `      📝 ${s.title.slice(0, 80)}\n\n`;
    }
  }

  if (onlineKick.length >= 1) {
    text += `🟢 <b>Kick</b>\n`;
    for (const s of onlineKick) {
      text += `   📺 <b><a href="https://kick.com/${s.name}">${s.name}</a></b> — 👁 ${s.viewers}\n`;
      text += `      📝 ${s.title.slice(0, 80)}\n\n`;
    }
  }

  try {
    await ctx.editMessageText(text.trimEnd(), { parse_mode: "HTML", reply_markup: backKb, disable_web_page_preview: true });
  } catch {}
});

router.callbackQuery("mySubscriptionsManage", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  ctx.session.awaitingAddInput = undefined;
  ctx.session.awaitingRemoveInput = undefined;
  await renderMySubscriptionsPage(ctx, 0, locale);
});

router.callbackQuery(/^manage_(twitch|kick)_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  const platform = ctx.match[1] as "kick" | "twitch";
  const channel_id = Number(ctx.match[2]);
  const follow = await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, platform);
  if (!follow) {
    return ctx.answerCallbackQuery({ text: t("follow.management.not_found", locale), show_alert: true });
  }
  const channel = await getChannelByChannelId(channel_id);
  const url = platform === "twitch" ? `https://twitch.tv/${channel?.channel_name}` : `https://kick.com/${channel?.channel_name}`;
  const deepLink = channel?.channel_name && ctx.me.username
    ? `https://t.me/${ctx.me.username}?start=prefollow_${platform}_${channel.channel_name}`
    : undefined;
  const shareUrl = deepLink ? `https://t.me/share/url?url=${encodeURIComponent(deepLink)}` : undefined;
  const message = t("follow.management.info", locale)
    .replace("{name}", channel?.channel_name || `ID:${channel_id}`)
    .replace("{platform}", t(`platform.${platform}`, locale))
    .replace("{url}", url)
    .replace("{date}", formatDateUTC(follow.created));
  await ctx.editMessageText(message, {
    parse_mode: "HTML",
    reply_markup: buildFollowManagementKeyboard(platform, channel_id, locale, shareUrl),
    disable_web_page_preview: true,
  });
});

router.callbackQuery(/^manage_unfollow_(twitch|kick)_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  const platform = ctx.match[1] as "kick" | "twitch";
  const channel_id = Number(ctx.match[2]);
  const channel = await getChannelByChannelId(channel_id);
  const channelName = channel?.channel_name || `ID:${channel_id}`;
  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, channel_id, platform);
  log.info("unfollowed via management", { userId: ctx.from.id, channel: channelName, channelId: channel_id, platform });
  await ctx.answerCallbackQuery({ text: t("follow.management.unfollow_success", locale).replace("{name}", channelName) });
  await renderMySubscriptionsPage(ctx, 0, locale);
});

router.callbackQuery(/^manage_online_(twitch|kick)_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const locale = await getUserLocale(ctx.from.id);
  const platform = ctx.match[1] as "kick" | "twitch";
  const channel_id = Number(ctx.match[2]);
  log.info("checked online via management", { userId: ctx.from.id, channelId: channel_id, platform });
  const channel = await getChannelByChannelId(channel_id);
  const channelName = channel?.channel_name || `ID:${channel_id}`;
  const backKb = new InlineKeyboard().text(t("follow.management.back", locale), "manage_back");

  if (platform === "twitch") {
    const streams = await getStreamsByUserIds([channel_id]);
    if (streams.length === 0) {
      return ctx.editMessageText(t("follow.management.online_no", locale).replace("{name}", channelName), {
        parse_mode: "HTML",
        reply_markup: backKb,
      });
    }
    const stream = streams[0];
    const text = t("follow.management.online_yes", locale)
      .replace("{name}", stream.user_name)
      .replace("{url}", `https://twitch.tv/${stream.user_name}`)
      .replace("{viewers}", String(stream.viewer_count))
      .replace("{game}", stream.game_name)
      .replace("{title}", stream.title);
    return ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: backKb,
      disable_web_page_preview: true,
    });
  } else {
    if (!channel?.channel_name) {
      return ctx.editMessageText(t("error.generic", locale), { parse_mode: "HTML", reply_markup: backKb });
    }
    const kickChannels = await getKickChannelsOnline([channel.channel_name]);
    const liveChannel = kickChannels.find((ch) => ch.is_live);
    if (!liveChannel) {
      return ctx.editMessageText(t("follow.management.online_no", locale).replace("{name}", channelName), {
        parse_mode: "HTML",
        reply_markup: backKb,
      });
    }
    const text = t("follow.management.online_yes_kick", locale)
      .replace("{name}", liveChannel.slug)
      .replace("{url}", `https://kick.com/${liveChannel.slug}`)
      .replace("{viewers}", String(liveChannel.viewer_count))
      .replace("{title}", liveChannel.stream_title);
    return ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: backKb,
      disable_web_page_preview: true,
    });
  }
});

router.callbackQuery("manage_back", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  await renderMySubscriptionsPage(ctx, 0, locale);
});

router.callbackQuery("infoCMD", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  let message = t("info.title", locale);
  message += t("info.about", locale);
  message += t("info.platforms", locale);
  message += t("info.commands", locale);
  message += t("info.notification_hint", locale);
  message += t("info.settings_hint", locale);
  message += `<a href="https://github.com/infybtw/twnotifier">GitHub</a>`;
  await ctx.editMessageText(message, { reply_markup: buildInfoBackKeyboard(locale), parse_mode: "HTML", disable_web_page_preview: true });
});

router.callbackQuery("toogleOnlineNotificationCMD", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  const newState = await toggleOnlineNotificationStateByUserId(ctx.from.id);
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildSettingsKeyboard(ctx.from.id, locale),
  });
  log.info("settings changed", {
    user_id: ctx.from.id,
    setting: "onlineNotification",
    new_state: newState,
  });
});

router.callbackQuery("toggleOfflineNotificationCMD", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  const newState = await toggleOfflineNotificationStateByUserId(ctx.from.id);
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildSettingsKeyboard(ctx.from.id, locale),
  });
  log.info("settings changed", {
    user_id: ctx.from.id,
    setting: "offlineNotification",
    new_state: newState,
  });
});

router.callbackQuery("toggleLinkPreviewCMD", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  const newState = await toggleLinkPreviewStateByUserId(ctx.from.id);
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildSettingsKeyboard(ctx.from.id, locale),
  });
  log.info("settings changed", {
    user_id: ctx.from.id,
    setting: "linkPreview",
    new_state: newState,
  });
});

router.callbackQuery("confirm_add", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (!ctx.session.pendingAdd) {
    return await ctx.editMessageText(
      t("commands.session_expired", locale),
      { parse_mode: "HTML" },
    );
  }

  const { displayName } = ctx.session.pendingAdd;

  await ctx.answerCallbackQuery();

  const { channelId, channelName, platform } = ctx.session.pendingAdd;

  await checkOrCreateChannel(channelId, displayName, platform)

  let subOnlineResCode = 100000
  let subOfflineResCode = 100000
  let subUpdateResCode = 100000

  if (platform === "twitch") {
    subOnlineResCode = await subscribeToChannelOnline(
      channelId,
      displayName || channelName,
    );
    subOfflineResCode = await subscribeToChannelOffline(
      channelId,
      displayName || channelName,
    );
    subUpdateResCode = await subscribeToChannelUpdate(
      channelId,
      displayName || channelName,
    );
  } else if (platform === "kick") {
    await subscribeToKickChannelOnline(channelId)
    subOnlineResCode = 200
    subOfflineResCode = 200
  }


  if (subOnlineResCode < 0 || subOfflineResCode < 0 || subUpdateResCode < 0) {
    log.error("subscribe error", { subOnlineResCode, subOfflineResCode, subUpdateResCode });
    await ctx.editMessageText(
      t("add.error", locale),
      { parse_mode: "HTML" },
    );
    ctx.session.pendingAdd = undefined;
    return;
  }


  if (subOfflineResCode < 0) {
    log.error("subscribe error", { subOfflineResCode });
    await ctx.editMessageText(
      t("add.error", locale),
      { parse_mode: "HTML" },
    );
    ctx.session.pendingAdd = undefined;
    return;
  }

  // Add follow
  try {
    const follow = (await checkOrCreateFollow(ctx.from.id, channelId, platform))
    ctx.session.pendingAdd = undefined;
    if (!follow.isNew) {
      return await ctx.editMessageText(t("add.already_exists", locale).replace("{name}", displayName), { parse_mode: "HTML" });
    }
    await ctx.editMessageText(t("add.success", locale).replace("{name}", displayName), { parse_mode: "HTML", reply_markup: buildBackHomeKeyboard(locale) });
    log.info("new follow", {
      userId: ctx.from.id,
      channel: displayName,
      platform: platform,
    });
  } catch (err) {
    log.error("follow error", {
      userId: ctx.from.id,
      channelId: channelId,
      platform: platform,
      error: err,
    })
    await ctx.editMessageText(t("error.generic", locale), { parse_mode: "HTML" })
  }
});

router.callbackQuery("cancel_add", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.pendingAdd) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t("subscriptions.add_cancelled", locale).replace("{name}", ctx.session.pendingAdd.displayName), { parse_mode: "HTML" });
    log.info("channel addition cancelled", {
      userId: ctx.from.id,
      channel: ctx.session.pendingAdd.displayName,
      platform: ctx.session.pendingAdd.platform,
    });
    ctx.session.pendingAdd = undefined;
  } else {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t("commands.no_active_process", locale), { parse_mode: "HTML" });
  }
});

router.callbackQuery("confirm_remove", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (!ctx.session.pendingRemove) {
    await ctx.answerCallbackQuery(
      t("commands.session_expired_remove", locale),
    );
    await ctx.editMessageText(
      t("commands.session_expired_remove", locale),
      { parse_mode: "HTML" },
    );
    return;
  }

  const { displayName, channelId, platform } = ctx.session.pendingRemove;

  await ctx.answerCallbackQuery();

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, channelId, platform);

  // Clear pending removal
  ctx.session.pendingRemove = undefined;

  await ctx.editMessageText(t("remove.success", locale).replace("{name}", displayName), { parse_mode: "HTML", reply_markup: buildBackHomeKeyboard(locale) });
  log.info("follow removed", {
    userId: ctx.from.id,
    channel: displayName,
    channelId: channelId,
    platform: platform
  });
});

router.callbackQuery("cancel_remove", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.pendingRemove) {
    const { displayName, platform } = ctx.session.pendingRemove;
    ctx.session.pendingRemove = undefined;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t("remove.cancelled", locale).replace("{name}", displayName), { parse_mode: "HTML" });
    log.info("channel removal cancelled", {
      userId: ctx.from.id,
      channel: displayName,
      platform
    });
  } else {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t("commands.no_active_remove", locale), { parse_mode: "HTML" });
  }
});

//admin routes
router.callbackQuery("admin_exit", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    ctx.session.adminLogin = undefined
    ctx.editMessageText(t("admin.exited", locale), {parse_mode: "HTML", reply_markup: await buildHomeKeyboard(ctx.from.id, locale)})
    log.warn(`${ctx.from.id} exit admin system`)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_settings", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    const message = t("admin.settings.title", locale)
    await ctx.editMessageText(message, {
      reply_markup: await buildAdminSettingsKeyboard(ctx.from.id, locale),
      parse_mode: "HTML",
    });
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_tz_change", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    const message = t("admin.settings.timezone_select", locale)
    await ctx.editMessageText(message, {
      reply_markup: buildTimezoneKeyboard(locale),
      parse_mode: "HTML",
    });
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_tz_(-?\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    const offset = Number(ctx.match[1])
    if (offset < -12 || offset > 14) {
      return ctx.answerCallbackQuery({ text: "Invalid offset", show_alert: true })
    }
    await setAdminTimezoneOffset(ctx.from.id, offset)
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`
    const message = t("admin.settings.timezone_saved", locale).replace("{offset}", `UTC${offsetStr}`)
    await ctx.editMessageText(message, {
      reply_markup: await buildAdminSettingsKeyboard(ctx.from.id, locale),
      parse_mode: "HTML",
    })
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

async function renderAdminChannelsPage(ctx: MyContext, page: number, locale: Locale) {
  const channels = await getChannels()
  const message = t("admin.channels", locale).replace("{count}", channels.length.toString())
  await ctx.editMessageText(message, { reply_markup: buildAdminChannelsKeyboard(channels, page, locale), parse_mode: "HTML" })
}

router.callbackQuery("admin_channels", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminChannelsPage(ctx, 0, locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_channels_page_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminChannelsPage(ctx, Number(ctx.match[1]), locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_channel_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (!ctx.session.adminLogin) {
    return ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
  const channel_id = Number(ctx.match[1])
  const channel = await getChannelByChannelId(channel_id)
  if (!channel) {
    return ctx.answerCallbackQuery({ text: t("admin.channel_not_found", locale), show_alert: true })
  }
  const platform = channel.platform === "twitch" ? "twitch" : "kick"
  const followers = await getChannelFollowersByChannelIdAndPlatform(channel_id, platform)
  const icon = channel.platform === "twitch" ? "🟣" : "🟢"
  const message = t("admin.channel_info", locale)
    .replace("{icon}", icon)
    .replace("{name}", channel.channel_name)
    .replace("{platform}", channel.platform || "unknown")
    .replace("{id}", channel.channel_id.toString())
    .replace("{followers}", followers.length.toString())
  await ctx.editMessageText(message, { reply_markup: buildAdminChannelDetailKeyboard(locale), parse_mode: "HTML" })
})

async function renderAdminUsersPage(ctx: MyContext, page: number, locale: Locale) {
  const users = await getUsersWithNotificationStatus()
  const inactiveLegend = users.some((user) => user.is_bot_blocked === 1)
    ? `${t("admin.users.inactive_legend", locale)}\n\n`
    : "";
  const message = t("admin.users", locale).replace("{count}", users.length.toString()) + inactiveLegend
  await ctx.editMessageText(message, { reply_markup: buildAdminUsersKeyboard(users, page, locale), parse_mode: "HTML" })
}

router.callbackQuery("admin_users", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminUsersPage(ctx, 0, locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_users_page_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminUsersPage(ctx, Number(ctx.match[1]), locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

async function renderAdminUserInfo(ctx: MyContext, user_id: number, locale: Locale, backKeyboard: InlineKeyboard): Promise<boolean> {
  const user = await getUserByUserId(user_id)
  if (!user) {
    return false
  }
  const adminSettings = await getAdminSettings(ctx.from!.id)
  const tzOffset = adminSettings?.utc_offset ?? 0
  const follows = await getFollowsByUserId(user_id)
  const message = t("admin.user_info", locale)
    .replace("{name}", user.first_name || "—")
    .replace("{username}", user.username ? `@${user.username}` : "—")
    .replace("{id}", user.user_id.toString())
    .replace("{date}", formatTimeForAdmin(user.created, tzOffset))
    .replace("{follows}", follows.length.toString())
    .replace("{is_admin}", user.is_admin ? "✅" : "🚫")
  await ctx.editMessageText(message, { reply_markup: backKeyboard, parse_mode: "HTML" })
  return true
}

router.callbackQuery(/^admin_user_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (!ctx.session.adminLogin) {
    return ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
  const rendered = await renderAdminUserInfo(ctx, Number(ctx.match[1]), locale, buildAdminUserDetailKeyboard(locale))
  if (!rendered) {
    return ctx.answerCallbackQuery({ text: t("admin.user_not_found", locale), show_alert: true })
  }
})

router.callbackQuery("noop", async (ctx) => {
  await ctx.answerCallbackQuery();
})

async function renderAdminAdminsPage(ctx: MyContext, page: number, locale: Locale) {
  const admins = await getAdmins()
  const message = t("admin.admins", locale).replace("{count}", admins.length.toString())
  await ctx.editMessageText(message, { reply_markup: buildAdminAdminsKeyboard(admins, page, locale), parse_mode: "HTML" })
}

router.callbackQuery("admin_admins", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminAdminsPage(ctx, 0, locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_admins_page_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminAdminsPage(ctx, Number(ctx.match[1]), locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_admin_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (!ctx.session.adminLogin) {
    return ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
  const rendered = await renderAdminUserInfo(ctx, Number(ctx.match[1]), locale, buildAdminAdminDetailKeyboard(locale))
  if (!rendered) {
    return ctx.answerCallbackQuery({ text: t("admin.user_not_found", locale), show_alert: true })
  }
})

router.callbackQuery("admin_add", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    ctx.editMessageText(t("admin.key_create", locale), {parse_mode: "HTML", reply_markup: buildAdminAddConfirmKeyboard(locale)})
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_add_confirm", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    const key = randomBytes(32).toString("base64url")
    const adminKey = await addAdminKey(ctx.from.id, key)
    if (!adminKey) {
      return ctx.editMessageText(t("admin.key_error", locale), {parse_mode: "HTML"})
    }
    let message = t("admin.key_created", locale).replace("{key}", `<tg-spoiler>${adminKey.key}</tg-spoiler>`)
    ctx.editMessageText(message, {parse_mode: "HTML", reply_markup: buildAdminBackKeyboard(locale)})
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

async function renderAdminKeysPage(ctx: MyContext, page: number, locale: Locale) {
  const keys = await getAllAdminKeys()
  if (keys.length < 1) {
    return ctx.editMessageText(t("admin.keys_title", locale), { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML" })
  }
  const unused = keys.filter(k => !k.used).length
  const used = keys.length - unused
  const message = t("admin.keys_header", locale).replace("{count}", keys.length.toString())
    + t("admin.keys_summary", locale).replace("{available}", unused.toString()).replace("{used}", used.toString())
  await ctx.editMessageText(message, { reply_markup: buildAdminKeysKeyboard(keys, page, locale), parse_mode: "HTML" })
}

router.callbackQuery("admin_keys", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminKeysPage(ctx, 0, locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_keys_page_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminKeysPage(ctx, Number(ctx.match[1]), locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_key_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (!ctx.session.adminLogin) {
    return ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
  const keyId = Number(ctx.match[1])
  const keys = await getAllAdminKeys()
  const key = keys.find(k => k.id === keyId)
  if (!key) {
    return ctx.answerCallbackQuery({ text: t("admin.key_not_found", locale), show_alert: true })
  }
  const adminSettings = await getAdminSettings(ctx.from.id)
  const tzOffset = adminSettings?.utc_offset ?? 0
  const status = key.used
    ? t("admin.key_status_used", locale).replace("{date}", key.used_date ? formatDateForAdmin(key.used_date, tzOffset) : "?")
    : t("admin.key_status_available", locale)
  const message = t("admin.key_info", locale)
    .replace("{key}", `<tg-spoiler>${key.key}</tg-spoiler>`)
    .replace("{issued_date}", formatDateForAdmin(key.issue_date, tzOffset))
    .replace("{issued_by}", `${key.issued_by_name || "Unknown"} (@${key.issued_by_username || "unknown"})`)
    .replace("{status}", status)
  await ctx.editMessageText(message, { reply_markup: buildAdminKeyDetailKeyboard(key.id, key.key, key.used ?? false, locale), parse_mode: "HTML" })
})

router.callbackQuery(/^admin_key_revoke_confirm_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    const keyId = Number(ctx.match[1])
    const revoked = await revokeAdminKey(keyId)
    if (!revoked) {
      return ctx.editMessageText(t("admin.key_revoke_error", locale), { reply_markup: buildAdminKeysBackKeyboard(locale), parse_mode: "HTML" })
    }
    let message = t("admin.key_revoked", locale).replace("{key}", revoked.key.slice(0, 12) + "...")
    ctx.editMessageText(message, { reply_markup: buildAdminKeysBackKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_back", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    let message = t("admin.panel", locale).replace("{name}", ctx.from.first_name).replace("{uptime}", formatUptime(STARTUP_TIME))
    ctx.editMessageText(message, { reply_markup: buildAdminKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsub", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    const subs = await getEventSubList()
    log.info(`${ctx.from.id} opened EventSub control`, { total: subs.length })
    const online = subs.filter(s => s.type === "stream.online").length
    const offline = subs.filter(s => s.type === "stream.offline").length
    const message = t("admin.eventsub_header", locale)
      .replace("{count}", subs.length.toString())
      .replace("{online}", online.toString())
      .replace("{offline}", offline.toString())
      .replace("{transport}", TWITCH_EVENT_TRANSPORT)
    ctx.editMessageText(message, { reply_markup: buildEventsubControlKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsubreload_confirm", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await ctx.editMessageText(t("admin.eventsub_restarting", locale), { parse_mode: "HTML" });
    const subs = await getEventSubList();

    const completedPhases: string[] = [];
    let lastEdit = 0;
    const onProgress = async ({ current, total, phase }: { current: number; total: number; phase: string }) => {
      const now = Date.now();
      if (now - lastEdit < 1500 && current < total) return;
      lastEdit = now;
      const lines = completedPhases.map(p => `${p} ✓`).join("\n");
      const currentLine = `${phase}\n${renderProgressBar(current, total)}`;
      const message = lines ? `${lines}\n\n${currentLine}` : currentLine;
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML" });
      } catch {}
      if (current === total) {
        completedPhases.push(`${phase} ${current}/${total}`);
      }
    };

    await deleteSubs(subs, onProgress);
    await sleep(2500);
    await subscribeAllStreamsOnline(onProgress);
    await subscribeAllStreamsOffline(onProgress);
    await subscribeAllChannelUpdates(onProgress);
    const newSubs = await getEventSubList();
    log.warn(`${ctx.from.id} reloaded EventSub`, { before: subs.length, after: newSubs.length });
    const summary = completedPhases.map(p => `${p} ✓`).join("\n");
    let successMessage = t("admin.eventsub_reloaded", locale)
      .replace("{before}", subs.length.toString())
      .replace("{after}", newSubs.length.toString());
    successMessage = `${summary}\n\n${successMessage}`;
    await ctx.editMessageText(successMessage, { reply_markup: buildEventsubResultKeyboard(locale), parse_mode: "HTML" });
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
});

router.callbackQuery("admin_eventsub_disconnect", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await ctx.editMessageText(t("admin.eventsub_disconnecting", locale), { parse_mode: "HTML" });
    const subs = await getEventSubList();

    const completedPhases: string[] = [];
    let lastEdit = 0;
    await deleteSubs(subs, async ({ current, total, phase }) => {
      const now = Date.now();
      if (now - lastEdit < 1500 && current < total) return;
      lastEdit = now;
      const lines = completedPhases.map(p => `${p} ✓`).join("\n");
      const currentLine = `${phase}\n${renderProgressBar(current, total)}`;
      const message = lines ? `${lines}\n\n${currentLine}` : currentLine;
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML" });
      } catch {}
      if (current === total) {
        completedPhases.push(`${phase} ${current}/${total}`);
      }
    });

    log.warn(`${ctx.from.id} disconnected EventSub`, { deleted: subs.length });
    const summary = completedPhases.map(p => `${p} ✓`).join("\n");
    let successMessage = t("admin.eventsub_disconnected", locale).replace("{count}", subs.length.toString());
    successMessage = `${summary}\n\n${successMessage}`;
    await ctx.editMessageText(successMessage, { reply_markup: buildEventsubResultKeyboard(locale), parse_mode: "HTML" });
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsub_cleanup", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await ctx.editMessageText(t("admin.eventsub_cleanup_searching", locale), { parse_mode: "HTML" });
    const subs = await getEventSubList();
    const orphaned = [];
    for (const sub of subs) {
      const channelId = sub.condition.broadcaster_user_id;
      if (!channelId) continue;
      const follows = await getChannelFollowersByChannelIdAndPlatform(Number(channelId), "twitch");
      if (follows.length === 0) orphaned.push(sub);
    }
    if (orphaned.length === 0) {
      log.info(`${ctx.from.id} EventSub cleanup - nothing to remove`, { total: subs.length });
      return ctx.editMessageText(t("admin.eventsub_no_orphans", locale).replace("{count}", subs.length.toString()), { reply_markup: buildEventsubControlKeyboard(locale), parse_mode: "HTML" });
    }

    const completedPhases: string[] = [];
    let lastEdit = 0;
    await deleteSubs(orphaned, async ({ current, total, phase }) => {
      const now = Date.now();
      if (now - lastEdit < 1500 && current < total) return;
      lastEdit = now;
      const lines = completedPhases.map(p => `${p} ✓`).join("\n");
      const currentLine = `${phase}\n${renderProgressBar(current, total)}`;
      const message = lines ? `${lines}\n\n${currentLine}` : currentLine;
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML" });
      } catch {}
      if (current === total) {
        completedPhases.push(`${phase} ${current}/${total}`);
      }
    });

    log.warn(`${ctx.from.id} EventSub cleanup`, { total: subs.length, removed: orphaned.length, remaining: subs.length - orphaned.length });
    const summary = completedPhases.map(p => `${p} ✓`).join("\n");
    let successMessage = t("admin.eventsub_cleanup_done", locale)
      .replace("{total}", subs.length.toString())
      .replace("{removed}", orphaned.length.toString())
      .replace("{remaining}", (subs.length - orphaned.length).toString());
    successMessage = `${summary}\n\n${successMessage}`;
    await ctx.editMessageText(successMessage, { reply_markup: buildEventsubResultKeyboard(locale), parse_mode: "HTML" });
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhook", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    const subs = await getKickSubscriptions()
    log.info(`${ctx.from.id} opened Webhook control`, { total: subs.length })
    const livestream = subs.filter(s => s.event === "livestream.status.updated").length
    const message = t("admin.webhook_header", locale)
      .replace("{count}", subs.length.toString())
      .replace("{livestream}", livestream.toString())
    ctx.editMessageText(message, { reply_markup: buildWebhookControlKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhookreload_confirm", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await ctx.editMessageText(t("admin.webhook_restarting", locale), { parse_mode: "HTML" });
    const subs = await getKickSubscriptions();
    const dbSubs = await getChannelsWithFollowersByPlatform("kick");

    const completedPhases: string[] = [];
    let lastEdit = 0;
    const onProgress = async ({ current, total, phase }: { current: number; total: number; phase: string }) => {
      const now = Date.now();
      if (now - lastEdit < 1500 && current < total) return;
      lastEdit = now;
      const lines = completedPhases.map(p => `${p} ✓`).join("\n");
      const currentLine = `${phase}\n${renderProgressBar(current, total)}`;
      const message = lines ? `${lines}\n\n${currentLine}` : currentLine;
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML" });
      } catch {}
      if (current === total) {
        completedPhases.push(`${phase} ${current}/${total}`);
      }
    };

    await deleteKickSubscriptions(subs, onProgress);
    await sleep(2500);
    await subscribeToKickChannelsOnline(dbSubs.map(s => s.channel_id!), onProgress);
    const newSubs = await getKickSubscriptions();
    log.warn(`${ctx.from.id} reloaded Webhooks`, { before: subs.length, after: newSubs.length });
    const summary = completedPhases.map(p => `${p} ✓`).join("\n");
    let successMessage = t("admin.webhook_reloaded", locale)
      .replace("{before}", subs.length.toString())
      .replace("{after}", newSubs.length.toString());
    successMessage = `${summary}\n\n${successMessage}`;
    await ctx.editMessageText(successMessage, { reply_markup: buildWebhookResultKeyboard(locale), parse_mode: "HTML" });
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhook_disconnect", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await ctx.editMessageText(t("admin.webhook_disconnecting", locale), { parse_mode: "HTML" });
    const subs = await getKickSubscriptions();

    const completedPhases: string[] = [];
    let lastEdit = 0;
    await deleteKickSubscriptions(subs, async ({ current, total, phase }) => {
      const now = Date.now();
      if (now - lastEdit < 1500 && current < total) return;
      lastEdit = now;
      const lines = completedPhases.map(p => `${p} ✓`).join("\n");
      const currentLine = `${phase}\n${renderProgressBar(current, total)}`;
      const message = lines ? `${lines}\n\n${currentLine}` : currentLine;
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML" });
      } catch {}
      if (current === total) {
        completedPhases.push(`${phase} ${current}/${total}`);
      }
    });

    log.warn(`${ctx.from.id} disconnected Webhooks`, { deleted: subs.length });
    const summary = completedPhases.map(p => `${p} ✓`).join("\n");
    let successMessage = t("admin.webhook_disconnected", locale).replace("{count}", subs.length.toString());
    successMessage = `${summary}\n\n${successMessage}`;
    await ctx.editMessageText(successMessage, { reply_markup: buildWebhookResultKeyboard(locale), parse_mode: "HTML" });
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhook_cleanup", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await ctx.editMessageText(t("admin.webhook_cleanup_searching", locale), { parse_mode: "HTML" });
    const subs = await getKickSubscriptions();
    const orphaned = [];
    for (const sub of subs) {
      const follows = await getChannelFollowersByChannelIdAndPlatform(Number(sub.broadcaster_user_id), "kick");
      if (follows.length === 0) orphaned.push(sub);
    }
    if (orphaned.length === 0) {
      log.info(`${ctx.from.id} Webhook cleanup - nothing to remove`, { total: subs.length });
      return ctx.editMessageText(t("admin.webhook_no_orphans", locale).replace("{count}", subs.length.toString()), { reply_markup: buildWebhookControlKeyboard(locale), parse_mode: "HTML" });
    }

    const completedPhases: string[] = [];
    let lastEdit = 0;
    await deleteKickSubscriptions(orphaned, async ({ current, total, phase }) => {
      const now = Date.now();
      if (now - lastEdit < 1500 && current < total) return;
      lastEdit = now;
      const lines = completedPhases.map(p => `${p} ✓`).join("\n");
      const currentLine = `${phase}\n${renderProgressBar(current, total)}`;
      const message = lines ? `${lines}\n\n${currentLine}` : currentLine;
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML" });
      } catch {}
      if (current === total) {
        completedPhases.push(`${phase} ${current}/${total}`);
      }
    });

    log.warn(`${ctx.from.id} Webhook cleanup`, { total: subs.length, removed: orphaned.length, remaining: subs.length - orphaned.length });
    const summary = completedPhases.map(p => `${p} ✓`).join("\n");
    let successMessage = t("admin.webhook_cleanup_done", locale)
      .replace("{total}", subs.length.toString())
      .replace("{removed}", orphaned.length.toString())
      .replace("{remaining}", (subs.length - orphaned.length).toString());
    successMessage = `${summary}\n\n${successMessage}`;
    await ctx.editMessageText(successMessage, { reply_markup: buildWebhookResultKeyboard(locale), parse_mode: "HTML" });
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

async function renderAdminFollowsPage(ctx: MyContext, page: number, locale: Locale) {
  const follows = await getAllFollowsWithDetails()
  if (follows.length < 1) {
    return ctx.editMessageText(t("admin.follows_empty", locale), { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML" })
  }
  const uniqueChannels = new Set(follows.map(f => `${f.platform}:${f.channel_id}`)).size
  const message = t("admin.follows_header", locale)
    .replace("{total}", follows.length.toString())
    .replace("{channels}", uniqueChannels.toString())
  await ctx.editMessageText(message, { reply_markup: buildAdminFollowsKeyboard(follows, page, locale), parse_mode: "HTML" })
}

router.callbackQuery("admin_follows", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminFollowsPage(ctx, 0, locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_follows_page_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    await renderAdminFollowsPage(ctx, Number(ctx.match[1]), locale)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_follow_(twitch|kick)_(\d+)_(\d+)$/, async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (!ctx.session.adminLogin) {
    return ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
  const platform = ctx.match[1] as "twitch" | "kick"
  const user_id = Number(ctx.match[2])
  const channel_id = Number(ctx.match[3])
  const follow = await getFollowByUserIdChannelIdAndPlatform(user_id, channel_id, platform)
  if (!follow) {
    return ctx.answerCallbackQuery({ text: t("admin.follow_not_found", locale), show_alert: true })
  }
  const user = await getUserByUserId(user_id)
  const channel = await getChannelByChannelId(channel_id)
  const adminSettings = await getAdminSettings(ctx.from.id)
  const tzOffset = adminSettings?.utc_offset ?? 0
  const icon = platform === "twitch" ? "🟣" : "🟢"
  const message = t("admin.follow_info", locale)
    .replace("{user}", user?.first_name || "Unknown")
    .replace("{username}", user?.username ? `@${user.username}` : "—")
    .replace("{channel}", channel?.channel_name || `ID:${channel_id}`)
    .replace("{icon}", icon)
    .replace("{platform}", platform)
    .replace("{date}", formatTimeForAdmin(follow.created, tzOffset))
  await ctx.editMessageText(message, { reply_markup: buildAdminFollowDetailKeyboard(locale), parse_mode: "HTML" })
})

router.callbackQuery("admin_logs", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    const adminSettings = await getAdminSettings(ctx.from.id)
    const tzOffset = adminSettings?.utc_offset ?? 0
    const logs = await getRecentStreamLogs(10)
    let message = t("admin.logs_header", locale)
    if (logs.length === 0) {
      message += t("admin.logs_empty", locale)
    } else {
      for (const entry of logs) {
        const platformIcon = entry.platform === "twitch" ? "🟣" : "🟢"
        const eventIcon = entry.event === "online" ? t("event.online", locale) : t("event.offline", locale)
        message += `${platformIcon} <b>${entry.channel_name || `ID:${entry.channel_id}`}</b>\n`
        message += `   ${eventIcon}\n`
        message += `   👥 ${t("admin.label.subscribers", locale)}: ${entry.follower_count ?? 0}\n`
        message += `   📅 ${formatTimeForAdmin(entry.created, tzOffset)}\n\n`
      }
    }
    ctx.editMessageText(message, { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_restart", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    ctx.editMessageText(t("admin.restart_confirm", locale), { reply_markup: buildRestartConfirmKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_restart_confirm", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    log.warn(`${ctx.from.id} initiated bot restart`)
    await ctx.editMessageText(t("admin.restarting", locale), { parse_mode: "HTML" })
    process.exit(0)
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
})

router.callbackQuery("platform_back", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  await ctx.editMessageText(t("start.welcome", locale), { reply_markup: await buildHomeKeyboard(ctx.from.id, locale), parse_mode: "HTML" });
  ctx.session.pendingPlatformSelect = undefined
});

router.callbackQuery("platform_twitch", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  const channel_id = Number(ctx.session.pendingPlatformSelect?.twitchData.id!)
  const display_name = ctx.session.pendingPlatformSelect?.twitchData.display_name.toLowerCase()!

  if (!ctx.from) {
    return ctx.editMessageText(t("error.generic", locale), { parse_mode: "HTML", reply_markup: buildBackHomeKeyboard(locale) });
  }

  if (await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, "twitch")) {
    return ctx.editMessageText(t("add.already_exists", locale).replace("{name}", display_name), { parse_mode: "HTML", reply_markup: buildBackHomeKeyboard(locale) });
  }

  ctx.session.pendingAdd = {
    channelId: channel_id,
    channelName: display_name,
    displayName: display_name,
    platform: "twitch"
  };

  let previewMessage = t("add.preview_platform", locale)
    .replace("{name}", display_name)
    .replace("{platform}", t("platform.twitch", locale))
    .replace("{url}", `https://twitch.tv/${display_name}`)

  log.info("showing channel preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id,
    platform: "twitch"
  });

  return await ctx.editMessageText(previewMessage, {
    reply_markup: buildAddConfirmationKeyboard(locale),
    parse_mode: "HTML",
  });
})

router.callbackQuery("platform_kick", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  const channel_id = Number(ctx.session.pendingPlatformSelect?.kickData.data[0].broadcaster_user_id!)
  const display_name = ctx.session.pendingPlatformSelect?.kickData.data[0].slug.toLowerCase()!

  if (!ctx.from) {
    return ctx.editMessageText(t("error.generic", locale), { parse_mode: "HTML", reply_markup: buildBackHomeKeyboard(locale) });
  }

  if (await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, "kick")) {
    return ctx.editMessageText(t("add.already_exists", locale).replace("{name}", display_name), { parse_mode: "HTML", reply_markup: buildBackHomeKeyboard(locale) });
  }

  ctx.session.pendingAdd = {
    channelId: channel_id,
    channelName: display_name,
    displayName: display_name,
    platform: "kick"
  };

  let previewMessage = t("add.preview_platform", locale)
    .replace("{name}", display_name)
    .replace("{platform}", t("platform.kick", locale))
    .replace("{url}", `https://kick.com/${display_name}`)

  log.info("showing channel preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id,
    platform: "kick"
  });

  return await ctx.editMessageText(previewMessage, {
    reply_markup: buildAddConfirmationKeyboard(locale),
    parse_mode: "HTML",
  });
})

router.callbackQuery("remove_platform_kick", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (!ctx.session.removePendingPlatformSelect) {
    await ctx.answerCallbackQuery(
      t("commands.session_expired_remove", locale),
    );
    await ctx.editMessageText(
      t("commands.session_expired_remove", locale),
      { parse_mode: "HTML" },
    );
    return;
  }

  const { kickChannel } = ctx.session.removePendingPlatformSelect;

  await ctx.answerCallbackQuery();

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, kickChannel.channel_id, "kick");

  ctx.session.removePendingPlatformSelect = undefined;

  await ctx.editMessageText(t("remove.success", locale).replace("{name}", kickChannel.channel_name), { parse_mode: "HTML", reply_markup: buildBackHomeKeyboard(locale) });
  log.info("follow removed", {
    userId: ctx.from.id,
    channel: kickChannel.channel_name,
    channelId: kickChannel.channel_id,
    platform: "kick"
  });
})

router.callbackQuery("remove_platform_twitch", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (!ctx.session.removePendingPlatformSelect) {
    await ctx.answerCallbackQuery(
      t("commands.session_expired_remove", locale),
    );
    await ctx.editMessageText(
      t("commands.session_expired_remove", locale),
      { parse_mode: "HTML" },
    );
    return;
  }

  const { twitchChannel } = ctx.session.removePendingPlatformSelect;

  await ctx.answerCallbackQuery();

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, twitchChannel.channel_id, "twitch");

  ctx.session.removePendingPlatformSelect = undefined;

  await ctx.editMessageText(t("remove.success", locale).replace("{name}", twitchChannel.channel_name), { parse_mode: "HTML", reply_markup: buildBackHomeKeyboard(locale) });
  log.info("follow removed", {
    userId: ctx.from.id,
    channel: twitchChannel.channel_name,
    channelId: twitchChannel.channel_id,
    platform: "twitch"
  });
})

router.callbackQuery("remove_platform_back", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.removePendingPlatformSelect) {
    const { twitchChannel, kickChannel } = ctx.session.removePendingPlatformSelect;
    ctx.session.removePendingPlatformSelect = undefined;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t("remove.cancelled", locale).replace("{name}", twitchChannel.channel_name), { parse_mode: "HTML" });
    log.info("channel removal cancelled", {
      userId: ctx.from.id,
      twithchChannel: twitchChannel.channel_name,
      kickChannel: kickChannel.channel_name
    });
  } else {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(t("commands.no_active_remove", locale), { parse_mode: "HTML" });
  }
});

router.callbackQuery("admin_broadcast", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  if (ctx.session.adminLogin) {
    ctx.session.broadcastPending = true;
    log.warn(`${ctx.from.id} initiated broadcast`);
    await ctx.editMessageText(t("admin.broadcast_title", locale), { reply_markup: buildBroadcastCancelKeyboard(locale), parse_mode: "Markdown" });
  } else {
    await ctx.editMessageText(t("admin.expired", locale), { parse_mode: "HTML" });
  }
});

router.callbackQuery("admin_broadcast_cancel", async (ctx) => {
  if (ctx.session.adminLogin && (ctx.session.broadcastPending || ctx.session.broadcastMessage)) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.session.broadcastPending = undefined;
    ctx.session.broadcastMessage = undefined;
    log.warn(`${ctx.from.id} cancelled broadcast`);
    await ctx.editMessageText(t("admin.broadcast_cancelled", locale), { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "Markdown" });
  }
});

router.callbackQuery("admin_broadcast_confirm", async (ctx) => {
  if (!ctx.session.adminLogin || !ctx.session.broadcastMessage) {
    return;
  }

  const locale = await getUserLocale(ctx.from.id);
  const { text, photoFileId } = ctx.session.broadcastMessage;
  ctx.session.broadcastMessage = undefined;

  log.warn(`${ctx.from.id} confirmed broadcast`, { has_photo: !!photoFileId, text_preview: (text || "").slice(0, 100) });
  await ctx.editMessageText(t("admin.broadcast_sending", locale), {parse_mode: "Markdown"});

  const { sent, failed } = await sendBroadcastMessage(text, photoFileId);

  log.warn(`${ctx.from.id} broadcast completed`, { sent, failed });
  let resultMessage = t("admin.broadcast_done", locale)
    .replace("{sent}", sent.toString())
    .replace("{failed}", failed.toString())
  await ctx.reply(resultMessage, { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "Markdown" });
});

router.callbackQuery("langCMD", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  await ctx.editMessageText(t("buttons.language", locale), {
    reply_markup: buildLanguageKeyboard(locale),
  });
});

router.callbackQuery("lang_ru", async (ctx) => {
  await setLanguageByUserId(ctx.from.id, "ru");
  await ctx.editMessageText(t("start.welcome", "ru"), {
    reply_markup: await buildHomeKeyboard(ctx.from.id, "ru"),
    parse_mode: "HTML",
  });
});

router.callbackQuery("lang_en", async (ctx) => {
  await setLanguageByUserId(ctx.from.id, "en");
  await ctx.editMessageText(t("start.welcome", "en"), {
    reply_markup: await buildHomeKeyboard(ctx.from.id, "en"),
    parse_mode: "HTML",
  });
});
