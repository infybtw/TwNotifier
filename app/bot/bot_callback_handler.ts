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
  buildMySubscriptionsKeyboard,
  buildMySubscriptionsAddBackKeyboard,
  buildRestartConfirmKeyboard,
  buildPlatformSelectKeyboard,
  buildRemovePlatformSelectKeyboard,
  buildRemoveConfirmationKeyboard,
  buildLanguageKeyboard,
} from "./keyboards";
import { getUserByUserId, setLanguageByUserId } from "../database/db";
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
  getFollowsByUserIdAndPlatform,
  getRecentStreamLogs,
  getUsers,
  removeFollowByUserIdChannelIdAndPlatfrom,
  revokeAdminKey,
} from "../database/db";
import {
  deleteSubs,
  getEventSubList,
  subscribeAllStreamsOffline,
  subscribeAllStreamsOnline,
  subscribeToChannelOffline,
  subscribeToChannelOnline,
} from "../twitchAPI/subscriptions";
import { getStreamsByUserIds } from "../twitchAPI/users";
import { getKickChannelsOnline } from "../kickAPI/users";
import logger from "../logger";
import { MyContext } from "./bot";
import { toggleLinkPreviewStateByUserId, toggleOfflineNotificationStateByUserId, toggleOnlineNotificationStateByUserId } from "../utils/settings";
import { randomBytes } from "node:crypto";
import { sleep } from "bun";
import { deleteKickSubscription, getKickSubscriptions, subscribeToKickChannelOnline } from "../kickAPI/subscription";
import { sendBroadcastMessage } from "./bot_sender";
import { t, Locale } from "../i18n";
import { getUserLocale } from "../utils/locale";

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
  let message = t("admin.panel", locale).replace("{name}", firstName);
  await ctx.editMessageText(message, { reply_markup: buildAdminKeyboard(locale), parse_mode: "HTML" });
});

router.callbackQuery("mySubscriptionsCMD", async (ctx) => {
  const locale = await getUserLocale(ctx.from.id);
  ctx.session.awaitingAddInput = undefined;
  ctx.session.awaitingRemoveInput = undefined;
  const user_id = ctx.from?.id;
  const kickFollows = await getFollowsByUserIdAndPlatform(user_id!, "kick");
  const twitchFollows = await getFollowsByUserIdAndPlatform(user_id!, "twitch");
  if (kickFollows.length < 1 && twitchFollows.length < 1) {
    await ctx.editMessageText(t("subscriptions.empty", locale), {
      parse_mode: "HTML",
      reply_markup: buildMySubscriptionsEmptyKeyboard(locale),
    });
    return;
  }
  const total = kickFollows.length + twitchFollows.length;
  let reply_text = t("commands.list_header", locale).replace("{total}", total.toString()) + "\n";
  if (twitchFollows.length >= 1) {
    reply_text += `\n🟣 <b>Twitch</b>\n`;
    for (const sub of twitchFollows) {
      const channel = await getChannelByChannelId(sub.channel_id!);
      reply_text += `   📺 ${channel?.channel_name || `ID:${sub.channel_id}`}\n`;
      reply_text += `      📅 ${sub.created.slice(0, 10)}\n\n`;
    }
  }
  if (kickFollows.length >= 1) {
    reply_text += `\n🟢 <b>Kick</b>\n`;
    for (const sub of kickFollows) {
      const channel = await getChannelByChannelId(sub.channel_id!);
      reply_text += `   📺 ${channel?.channel_name || `ID:${sub.channel_id}`}\n`;
      reply_text += `      📅 ${sub.created.slice(0, 10)}\n\n`;
    }
  }
  await ctx.editMessageText(reply_text.trimEnd(), { parse_mode: "HTML", reply_markup: buildMySubscriptionsKeyboard(locale) });
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

  const backKb = new InlineKeyboard().text(t("buttons.back", locale), "mySubscriptionsCMD");

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
      text += `   📺 <b>${s.name}</b> — 👁 ${s.viewers}\n`;
      text += `      🎮 ${s.game}\n`;
      text += `      📝 ${s.title.slice(0, 80)}\n\n`;
    }
  }

  if (onlineKick.length >= 1) {
    text += `🟢 <b>Kick</b>\n`;
    for (const s of onlineKick) {
      text += `   📺 <b>${s.name}</b> — 👁 ${s.viewers}\n`;
      text += `      📝 ${s.title.slice(0, 80)}\n\n`;
    }
  }

  try {
    await ctx.editMessageText(text.trimEnd(), { parse_mode: "HTML", reply_markup: backKb });
  } catch {}
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

  if (platform === "twitch") {
    subOnlineResCode = await subscribeToChannelOnline(
      channelId,
      displayName || channelName,
    );
    subOfflineResCode = await subscribeToChannelOffline(
      channelId,
      displayName || channelName,
    );
  } else if (platform === "kick") {
    await subscribeToKickChannelOnline(channelId)
    subOnlineResCode = 200
    subOfflineResCode = 200
  }


  if (subOnlineResCode < 0) {
    log.error("subscribe error", { subResponseCode: subOnlineResCode });
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
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.session.adminLogin = undefined
    ctx.editMessageText(t("admin.exited", locale), {parse_mode: "HTML", reply_markup: await buildHomeKeyboard(ctx.from.id, locale)})
    log.warn(`${ctx.from.id} exit admin system`)
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_channels", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    const channels = await getChannels()
    let message = t("admin.channels", locale).replace("{count}", channels.length.toString())
    for (const channel of channels) {
      const icon = channel.platform === "twitch" ? "🟣" : "🟢"
      message += `${icon} <b>${channel.channel_name}</b>\n`
      message += `   ID: <code>${channel.channel_id}</code>\n`
    }
    ctx.editMessageText(message, {reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML"})
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_users", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    const users = await getUsers()
    let message = t("admin.users", locale).replace("{count}", users.length.toString())
    for (const user of users) {
      message += `👤 <b>${user.first_name}</b> (@${user.username})\n`
      message += `   ID: <code>${user.user_id}</code>\n`
      message += `   📅 ${user.created}\n\n`
    }
    ctx.editMessageText(message, {reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML"})
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_admins", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    const users = await getAdmins()
    let message = t("admin.admins", locale).replace("{count}", users.length.toString())
    for (const user of users) {
      message += `⚡ <b>${user.first_name}</b> (@${user.username})\n`
      message += `   ID: <code>${user.user_id}</code>\n`
      message += `   📅 ${user.created}\n\n`
    }
    ctx.editMessageText(message, {reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML"})
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_add", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.editMessageText(t("admin.key_create", locale), {parse_mode: "HTML", reply_markup: buildAdminAddConfirmKeyboard(locale)})
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_add_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    const key = randomBytes(32).toString("base64url")
    const adminKey = await addAdminKey(ctx.from.id, key)
    if (!adminKey) {
      return ctx.editMessageText(t("admin.key_error", locale), {parse_mode: "HTML"})
    }
    let message = t("admin.key_created", locale).replace("{key}", `<tg-spoiler>${adminKey.key}</tg-spoiler>`)
    ctx.editMessageText(message, {parse_mode: "HTML", reply_markup: buildAdminBackKeyboard(locale)})
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_keys", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    const keys = await getAllAdminKeys()
    if (keys.length < 1) {
      return ctx.editMessageText(t("admin.keys_title", locale), { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML" })
    }

    let message = t("admin.keys_header", locale).replace("{count}", keys.length.toString())

    const unused = keys.filter(k => !k.used)
    const used = keys.filter(k => k.used)

    if (unused.length > 0) {
      message += t("admin.keys_available", locale).replace("{count}", unused.length.toString())
      for (const k of unused) {
        message += `\n<code>${k.key.slice(0, 16)}...</code>\n`
        message += `   📅 ${k.issue_date.slice(0, 10)}\n`
        message += `   👤 ${k.issued_by_name || "Unknown"} (@${k.issued_by_username || "unknown"})\n`
      }
    }

    if (used.length > 0) {
      message += t("admin.keys_used", locale).replace("{count}", used.length.toString())
      for (const k of used) {
        message += `\n<code>${k.key.slice(0, 16)}...</code>\n`
        message += `   📅 ${k.issue_date.slice(0, 10)}\n`
        message += `   ✅ ${k.used_date?.slice(0, 10) || "?"}\n`
      }
    }

    const { InlineKeyboard } = await import("grammy")
    const kb = new InlineKeyboard()
    for (const k of unused) {
      kb.text(t("admin.btn.revoke_key", locale).replace("{key}", k.key.slice(0, 8) + "..."), `admin_key_revoke_confirm_${k.id}`).row()
    }
    kb.text(t("buttons.back", locale), "admin_back")

    ctx.editMessageText(message, { reply_markup: kb, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_key_revoke_confirm_(\d+)$/, async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    const keyId = Number(ctx.match[1])
    const revoked = await revokeAdminKey(keyId)
    if (!revoked) {
      return ctx.editMessageText(t("admin.key_revoke_error", locale), { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML" })
    }
    let message = t("admin.key_revoked", locale).replace("{key}", revoked.key.slice(0, 12) + "...")
    ctx.editMessageText(message, { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_back", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    let message = t("admin.panel", locale).replace("{name}", ctx.from.first_name)
    ctx.editMessageText(message, { reply_markup: buildAdminKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsub", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    const subs = await getEventSubList()
    log.info(`${ctx.from.id} opened EventSub control`, { total: subs.length })
    let message = t("admin.eventsub_header", locale).replace("{count}", subs.length.toString())
    if (subs.length > 0) {
      message += `\n`
      for (const sub of subs) {
        const icon = sub.status === "enabled" ? "✅" : "⚠️"
        message += `${icon} <code>${sub.type}</code>\n`
        message += `   ID: <code>${sub.id.slice(0, 16)}...</code>\n`
        message += `   ${t("admin.label.status", locale)}: ${sub.status}\n`
        if (sub.condition.broadcaster_user_id) {
          message += `   ${t("admin.label.channel_id", locale)}: <code>${sub.condition.broadcaster_user_id}</code>\n`
        }
      }
    }
    ctx.editMessageText(message, { reply_markup: buildEventsubControlKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsubreload_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.editMessageText(t("admin.eventsub_restarting", locale), {parse_mode: "HTML"})
    const subs = await getEventSubList()
    await deleteSubs(subs)
    await sleep(2500)
    await subscribeAllStreamsOnline()
    await subscribeAllStreamsOffline()
    const newSubs = await getEventSubList()
    log.warn(`${ctx.from.id} reloaded EventSub`, { before: subs.length, after: newSubs.length })
    let successMessage = t("admin.eventsub_reloaded", locale)
      .replace("{before}", subs.length.toString())
      .replace("{after}", newSubs.length.toString())
    ctx.editMessageText(successMessage, { reply_markup: buildEventsubResultKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsub_disconnect", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.editMessageText(t("admin.eventsub_disconnecting", locale), {parse_mode: "HTML"})
    const subs = await getEventSubList()
    await deleteSubs(subs)
    log.warn(`${ctx.from.id} disconnected EventSub`, { deleted: subs.length })
    let successMessage = t("admin.eventsub_disconnected", locale).replace("{count}", subs.length.toString())
    ctx.editMessageText(successMessage, { reply_markup: buildEventsubResultKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsub_cleanup", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.editMessageText(t("admin.eventsub_cleanup_searching", locale), {parse_mode: "HTML"})
    const subs = await getEventSubList()
    const orphaned = []
    for (const sub of subs) {
      const channelId = sub.condition.broadcaster_user_id
      if (!channelId) continue
      const follows = await getChannelFollowersByChannelIdAndPlatform(Number(channelId), "twitch")
      if (follows.length === 0) orphaned.push(sub)
    }
    if (orphaned.length === 0) {
      log.info(`${ctx.from.id} EventSub cleanup - nothing to remove`, { total: subs.length })
      return ctx.editMessageText(t("admin.eventsub_no_orphans", locale).replace("{count}", subs.length.toString()), { reply_markup: buildEventsubControlKeyboard(locale), parse_mode: "HTML" })
    }
    await deleteSubs(orphaned)
    log.warn(`${ctx.from.id} EventSub cleanup`, { total: subs.length, removed: orphaned.length, remaining: subs.length - orphaned.length })
    let successMessage = t("admin.eventsub_cleanup_done", locale)
      .replace("{total}", subs.length.toString())
      .replace("{removed}", orphaned.length.toString())
      .replace("{remaining}", (subs.length - orphaned.length).toString())
    ctx.editMessageText(successMessage, { reply_markup: buildEventsubResultKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhook", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    const subs = await getKickSubscriptions()
    log.info(`${ctx.from.id} opened Webhook control`, { total: subs.length })
    let message = t("admin.webhook_header", locale).replace("{count}", subs.length.toString())
    if (subs.length > 0) {
      message += `\n`
      for (const sub of subs) {
        message += `📌 <code>${sub.event}</code>\n`
        message += `   ID: <code>${sub.id}</code>\n`
        message += `   ${t("admin.label.channel_id", locale)}: <code>${sub.broadcaster_user_id}</code>\n`
        message += `   ${t("admin.label.created", locale)}: ${sub.created_at}\n`
      }
    }
    ctx.editMessageText(message, { reply_markup: buildWebhookControlKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhookreload_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.editMessageText(t("admin.webhook_restarting", locale), {parse_mode: "HTML"})
    const subs = await getKickSubscriptions()
    const dbSubs = await getChannelsWithFollowersByPlatform("kick")
    for (const sub of subs) {
      await deleteKickSubscription(sub)
    }
    await sleep(2500)
    for (const sub of dbSubs) {
      await subscribeToKickChannelOnline(sub.channel_id!)
    }
    const newSubs = await getKickSubscriptions()
    log.warn(`${ctx.from.id} reloaded Webhooks`, { before: subs.length, after: newSubs.length })
    let successMessage = t("admin.webhook_reloaded", locale)
      .replace("{before}", subs.length.toString())
      .replace("{after}", newSubs.length.toString())
    ctx.editMessageText(successMessage, {reply_markup: buildWebhookResultKeyboard(locale), parse_mode: "HTML"})
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhook_disconnect", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.editMessageText(t("admin.webhook_disconnecting", locale), {parse_mode: "HTML"})
    const subs = await getKickSubscriptions()
    for (const sub of subs) {
      await deleteKickSubscription(sub)
    }
    log.warn(`${ctx.from.id} disconnected Webhooks`, { deleted: subs.length })
    let successMessage = t("admin.webhook_disconnected", locale).replace("{count}", subs.length.toString())
    ctx.editMessageText(successMessage, { reply_markup: buildWebhookResultKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhook_cleanup", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.editMessageText(t("admin.webhook_cleanup_searching", locale), {parse_mode: "HTML"})
    const subs = await getKickSubscriptions()
    const orphaned = []
    for (const sub of subs) {
      const follows = await getChannelFollowersByChannelIdAndPlatform(Number(sub.broadcaster_user_id), "kick")
      if (follows.length === 0) orphaned.push(sub)
    }
    if (orphaned.length === 0) {
      log.info(`${ctx.from.id} Webhook cleanup - nothing to remove`, { total: subs.length })
      return ctx.editMessageText(t("admin.webhook_no_orphans", locale).replace("{count}", subs.length.toString()), { reply_markup: buildWebhookControlKeyboard(locale), parse_mode: "HTML" })
    }
    for (const sub of orphaned) {
      await deleteKickSubscription(sub)
    }
    log.warn(`${ctx.from.id} Webhook cleanup`, { total: subs.length, removed: orphaned.length, remaining: subs.length - orphaned.length })
    let successMessage = t("admin.webhook_cleanup_done", locale)
      .replace("{total}", subs.length.toString())
      .replace("{removed}", orphaned.length.toString())
      .replace("{remaining}", (subs.length - orphaned.length).toString())
    ctx.editMessageText(successMessage, { reply_markup: buildWebhookResultKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_follows", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    const follows = await getAllFollowsWithDetails()
    if (follows.length < 1) {
      return ctx.editMessageText(t("admin.follows_empty", locale), { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML" })
    }

    const grouped = new Map<string, typeof follows>()
    for (const follow of follows) {
      const key = `${follow.platform}:${follow.channel_name}`
      const arr = grouped.get(key) || []
      arr.push(follow)
      grouped.set(key, arr)
    }

    let message = t("admin.follows_header", locale)
      .replace("{total}", follows.length.toString())
      .replace("{channels}", grouped.size.toString())
    for (const [key, subs] of grouped) {
      const platform = subs[0].platform
      const channel = subs[0].channel_name
      const platformIcon = platform === "twitch" ? "🟣" : "🟢"
      message += `\n${platformIcon} <b>${channel}</b>\n`
      message += `   ${subs.length} ${t("admin.label.subscribed", locale)}:\n`
      for (const sub of subs) {
        message += `   👤 ${sub.first_name || "Unknown"} (@${sub.username || "unknown"})\n`
        message += `      📅 ${sub.created.slice(0, 10)}\n`
      }
    }
    ctx.editMessageText(message, { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_logs", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
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
        message += `   📅 ${entry.created}\n\n`
      }
    }
    ctx.editMessageText(message, { reply_markup: buildAdminBackKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_restart", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.editMessageText(t("admin.restart_confirm", locale), { reply_markup: buildRestartConfirmKeyboard(locale), parse_mode: "HTML" })
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_restart_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    log.warn(`${ctx.from.id} initiated bot restart`)
    await ctx.editMessageText(t("admin.restarting", locale), { parse_mode: "HTML" })
    process.exit(0)
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
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
  if (ctx.session.adminLogin) {
    const locale = await getUserLocale(ctx.from.id);
    ctx.session.broadcastPending = true;
    log.warn(`${ctx.from.id} initiated broadcast`);
    await ctx.editMessageText(t("admin.broadcast_title", locale), { reply_markup: buildBroadcastCancelKeyboard(locale), parse_mode: "Markdown" });
  } else {
    await ctx.editMessageText(t("admin.expired", "ru"), { parse_mode: "HTML" });
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
