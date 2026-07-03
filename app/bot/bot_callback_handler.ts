import { Composer } from "grammy";
import { buildSettingsKeyboard, buildHomeKeyboard,  adminKeyboard, adminBackKeyboard, addConfirmationKeyboard, broadcastCancelKeyboard, broadcastConfirmKeyboard, infoBackKeyboard, eventsubControlKeyboard, eventsubResultKeyboard, webhookControlKeyboard, webhookResultKeyboard, adminAddConfirmKeyboard, backHomeKeyboard, mySubscriptionsEmptyKeyboard, mySubscriptionsKeyboard, mySubscriptionsAddBackKeyboard } from "./keyboards";
import { getUserByUserId } from "../database/db";
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
import logger from "../logger";
import { MyContext } from "./bot";
import { toggleOfflineNotificationStateByUserId, toggleOnlineNotificationStateByUserId } from "../utils/settings";
import { randomBytes } from "node:crypto";
import { sleep } from "bun";
import { deleteKickSubscription, getKickSubscriptions, subscribeToKickChannelOnline } from "../kickAPI/subscription";
import { sendBroadcastMessage } from "./bot_sender";

export const router = new Composer<MyContext>();

const log = logger.getSubLogger({ name: "bot:callback_handler" });

router.callbackQuery("settingsCMD", async (ctx) => {
  let message = `⚙️ <b>Настройки</b>\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `Выберите параметры уведомлений:`
  await ctx.editMessageText(message, {
    //@ts-ignore
    reply_markup: await buildSettingsKeyboard(ctx.from.id),
    parse_mode: "HTML",
  });
});

router.callbackQuery("settingsBACK", async (ctx) => {
  let message = `🏠 <b>TwNotifier</b>\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `Бот для отслеживания стримов\n\n`
  message += `📌 <b>Команды:</b>\n`
  message += `• /add канал — добавить канал\n`
  message += `• /remove канал — удалить канал\n`
  message += `• /list — мои подписки`
  await ctx.editMessageText(message, { reply_markup: await buildHomeKeyboard(ctx.from.id), parse_mode: "HTML" });
});

router.callbackQuery("adminCMD", async (ctx) => {
  const user = await getUserByUserId(ctx.from?.id!);
  if (!user?.is_admin) {
    return ctx.answerCallbackQuery({ text: "Доступ запрещён", show_alert: true });
  }
  ctx.session.adminLogin = { signed_in: true };
  log.warn(`${ctx.from?.id} enter admin system`);
  const firstName = ctx.from?.first_name || "Admin";
  let message = `🛡️ <b>Панель управления</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `Добро пожаловать, ${firstName}!\n\n`;
  message += `Выберите раздел для управления:`;
  await ctx.editMessageText(message, { reply_markup: adminKeyboard, parse_mode: "HTML" });
});

router.callbackQuery("mySubscriptionsCMD", async (ctx) => {
  ctx.session.awaitingAddInput = undefined;
  ctx.session.awaitingRemoveInput = undefined;
  const user_id = ctx.from?.id;
  const kickFollows = await getFollowsByUserIdAndPlatform(user_id!, "kick");
  const twitchFollows = await getFollowsByUserIdAndPlatform(user_id!, "twitch");
  if (kickFollows.length < 1 && twitchFollows.length < 1) {
    await ctx.editMessageText("📭 <b>Нет подписок</b>\n\nВы пока не отслеживаете ни одного канала.", {
      parse_mode: "HTML",
      reply_markup: mySubscriptionsEmptyKeyboard,
    });
    return;
  }
  const total = kickFollows.length + twitchFollows.length;
  let reply_text = `📊 <b>Мои подписки</b>\n`;
  reply_text += `━━━━━━━━━━━━━━━━━━━━\n`;
  reply_text += `Всего: <b>${total}</b>\n`;
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
  await ctx.editMessageText(reply_text.trimEnd(), { parse_mode: "HTML", reply_markup: mySubscriptionsKeyboard });
});

router.callbackQuery("mySubscriptionsAdd", async (ctx) => {
  ctx.session.awaitingAddInput = true;
  await ctx.editMessageText(
    "➕ <b>Добавление канала</b>\n━━━━━━━━━━━━━━━━━━━━\n\nОтправьте имя канала или ссылку:\n\nПример: <code>xqc</code> или <code>https://twitch.tv/xqc</code>",
    { parse_mode: "HTML", reply_markup: mySubscriptionsAddBackKeyboard },
  );
});

router.callbackQuery("mySubscriptionsRemove", async (ctx) => {
  ctx.session.awaitingRemoveInput = true;
  await ctx.editMessageText(
    "🗑 <b>Удаление канала</b>\n━━━━━━━━━━━━━━━━━━━━\n\nОтправьте имя канала или ссылку для удаления:\n\nПример: <code>xqc</code> или <code>https://twitch.tv/xqc</code>",
    { parse_mode: "HTML", reply_markup: mySubscriptionsAddBackKeyboard },
  );
});

router.callbackQuery("infoCMD", async (ctx) => {
  let message = `ℹ️ <b>О боте</b>\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `<b>TwNotifier</b> — бот для отслеживания стримов\n\n`
  message += `📺 <b>Платформы:</b>\n`
  message += `🟣 Twitch\n`
  message += `🟢 Kick\n\n`
  message += `📌 <b>Команды:</b>\n`
  message += `/add имя канала — добавить канал\n`
  message += `/remove имя канала — удалить канал\n`
  message += `/list — мои подписки\n\n`
  message += `🔔 Бот пришлёт уведомление, когда стример выйдет в эфир или завершит трансляцию.\n\n`
  message += `⚙️ Настройки уведомлений — в разделе «Настройки».\n\n`
  message += `<a href="https://github.com/infybtw/twnotifier">GitHub</a>`
  await ctx.editMessageText(message, { reply_markup: infoBackKeyboard, parse_mode: "HTML", disable_web_page_preview: true });
});

router.callbackQuery("toogleOnlineNotificationCMD", async (ctx) => {
  const newState = await toggleOnlineNotificationStateByUserId(ctx.from.id);
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildSettingsKeyboard(ctx.from.id),
  });
  log.info("settings changed", {
    user_id: ctx.from.id,
    setting: "onlineNotification",
    new_state: newState,
  });
});

router.callbackQuery("toggleOfflineNotificationCMD", async (ctx) => {
  const newState = await toggleOfflineNotificationStateByUserId(ctx.from.id);
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildSettingsKeyboard(ctx.from.id),
  });
  log.info("settings changed", {
    user_id: ctx.from.id,
    setting: "offlineNotification",
    new_state: newState,
  });
});

router.callbackQuery("confirm_add", async (ctx) => {
  if (!ctx.session.pendingAdd) {
    return await ctx.editMessageText(
      "⏱️ <b>Сессия истекла</b>\n\nИспользуйте /add для добавления канала.",
      { parse_mode: "HTML" },
    );
  }

  const { displayName } = ctx.session.pendingAdd;

  await ctx.answerCallbackQuery("Добавляем канал...");

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
      "❌ <b>Ошибка подписки</b>\n\nПопробуйте позже или обратитесь в тех. поддержку.",
      { parse_mode: "HTML" },
    );
    ctx.session.pendingAdd = undefined;
    return;
  }


  if (subOfflineResCode < 0) {
    log.error("subscribe error", { subOfflineResCode });
    await ctx.editMessageText(
      "❌ <b>Ошибка подписки</b>\n\nПопробуйте позже или обратитесь в тех. поддержку.",
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
      return await ctx.editMessageText(`ℹ️ <b>Уже отслеживаете</b>\n\nВы уже отслеживаете ${displayName}`, { parse_mode: "HTML" });
    }
    await ctx.editMessageText(`✅ <b>Канал добавлен</b>\n\nТеперь вы отслеживаете ${displayName}`, { parse_mode: "HTML", reply_markup: backHomeKeyboard });
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
    await ctx.editMessageText(`❌ <b>Ошибка</b>\n\nУже работаем над исправлением!`, { parse_mode: "HTML" })
  }
});

router.callbackQuery("cancel_add", async (ctx) => {
  if (ctx.session.pendingAdd) {
    await ctx.answerCallbackQuery("Добавление отменено");
    await ctx.editMessageText(`🚫 <b>Добавление отменено</b>\n\nКанал ${ctx.session.pendingAdd.displayName} не добавлен.`, { parse_mode: "HTML" });
    log.info("channel addition cancelled", {
      userId: ctx.from.id,
      channel: ctx.session.pendingAdd.displayName,
      platform: ctx.session.pendingAdd.platform,
    });
    ctx.session.pendingAdd = undefined;
  } else {
    await ctx.answerCallbackQuery("Нет активного добавления");
    await ctx.editMessageText("ℹ️ <b>Нет активного процесса</b>\n\nДобавление канала не было начато.", { parse_mode: "HTML" });
  }
});

router.callbackQuery("confirm_remove", async (ctx) => {
  if (!ctx.session.pendingRemove) {
    await ctx.answerCallbackQuery(
      "Сессия истекла. Пожалуйста, начните удаление заново.",
    );
    await ctx.editMessageText(
      "⏱️ <b>Сессия истекла</b>\n\nИспользуйте /remove для удаления канала.",
      { parse_mode: "HTML" },
    );
    return;
  }

  const { displayName, channelId, platform } = ctx.session.pendingRemove;

  await ctx.answerCallbackQuery("Удаляем канал...");

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, channelId, platform);

  // Clear pending removal
  ctx.session.pendingRemove = undefined;

  await ctx.editMessageText(`✅ <b>Канал удалён</b>\n\n${displayName} удалён из отслеживаемых.`, { parse_mode: "HTML", reply_markup: backHomeKeyboard });
  log.info("follow removed", {
    userId: ctx.from.id,
    channel: displayName,
    channelId: channelId,
    platform: platform
  });
});

router.callbackQuery("cancel_remove", async (ctx) => {
  if (ctx.session.pendingRemove) {
    const { displayName, platform } = ctx.session.pendingRemove;
    ctx.session.pendingRemove = undefined;
    await ctx.answerCallbackQuery("Удаление отменено");
    await ctx.editMessageText(`🚫 <b>Удаление отменено</b>\n\nКанал ${displayName} не удалён.`, { parse_mode: "HTML" });
    log.info("channel removal cancelled", {
      userId: ctx.from.id,
      channel: displayName,
      platform
    });
  } else {
    await ctx.answerCallbackQuery("Нет активного удаления");
    await ctx.editMessageText("ℹ️ <b>Нет активного процесса</b>\n\nУдаление канала не было начато.", { parse_mode: "HTML" });
  }
});

//admin routes
router.callbackQuery("admin_exit", async (ctx) => {
  if (ctx.session.adminLogin) {
    ctx.session.adminLogin = undefined
    let message = `👋 <b>Выход из панели</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы успешно вышли из панели управления.`
    ctx.editMessageText(message, {parse_mode: "HTML", reply_markup: await buildHomeKeyboard(ctx.from.id)})
    log.warn(`${ctx.from.id} exit admin system`)
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_channels", async (ctx) => {
  if (ctx.session.adminLogin) {
    const channels = await getChannels()
    let message = `📺 <b>Управление каналами</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Всего отслеживается: <b>${channels.length}</b> канал(ов)\n\n`
    for (const channel of channels) {
      const icon = channel.platform === "twitch" ? "🟣" : "🟢"
      message += `${icon} <b>${channel.channel_name}</b>\n`
      message += `   ID: <code>${channel.channel_id}</code>\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard, parse_mode: "HTML"})
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_users", async (ctx) => {
  if (ctx.session.adminLogin) {
    const users = await getUsers()
    let message = `👥 <b>Зарегистрированные пользователи</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Всего: <b>${users.length}</b>\n\n`
    for (const user of users) {
      message += `👤 <b>${user.first_name}</b> (@${user.username})\n`
      message += `   ID: <code>${user.user_id}</code>\n`
      message += `   📅 ${user.created}\n\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard, parse_mode: "HTML"})
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_admins", async (ctx) => {
  if (ctx.session.adminLogin) {
    const users = await getAdmins()
    let message = `🛡️ <b>Администраторы системы</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Всего: <b>${users.length}</b>\n\n`
    for (const user of users) {
      message += `⚡ <b>${user.first_name}</b> (@${user.username})\n`
      message += `   ID: <code>${user.user_id}</code>\n`
      message += `   📅 ${user.created}\n\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard, parse_mode: "HTML"})
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_add", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔑 <b>Создание админ-ключа</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы собираетесь создать новый ключ администратора.\n\n`
    message += `⚠️ Ключ будет сгенерирован однократно.`
    ctx.editMessageText(message, {parse_mode: "HTML", reply_markup: adminAddConfirmKeyboard})
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_add_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    const key = randomBytes(32).toString("base64url")
    const adminKey = await addAdminKey(ctx.from.id, key)
    if (!adminKey) {
      return ctx.editMessageText("❌ <b>Ошибка генерации ключа</b>\n\nНе удалось создать админ-ключ. Попробуйте позже.", {parse_mode: "HTML"})
    }
    let message = `✅ <b>Админ-ключ создан</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `<tg-spoiler>${adminKey.key}</tg-spoiler>\n\n`
    message += `📤 Передайте ключ новому администратору\n`
    message += `📌 Используйте: /becomeAdmin ключ`
    ctx.editMessageText(message, {parse_mode: "HTML", reply_markup: adminBackKeyboard})
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_keys", async (ctx) => {
  if (ctx.session.adminLogin) {
    const keys = await getAllAdminKeys()
    if (keys.length < 1) {
      return ctx.editMessageText("🔑 <b>Админ-ключи</b>\n━━━━━━━━━━━━━━━━━━━━\n\nНет созданных ключей.", { reply_markup: adminBackKeyboard, parse_mode: "HTML" })
    }

    let message = `🔑 <b>Админ-ключи</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Всего: <b>${keys.length}</b>\n\n`

    const unused = keys.filter(k => !k.used)
    const used = keys.filter(k => k.used)

    if (unused.length > 0) {
      message += `📥 <b>Доступные (${unused.length}):</b>\n`
      for (const k of unused) {
        message += `\n<code>${k.key.slice(0, 16)}...</code>\n`
        message += `   📅 ${k.issue_date.slice(0, 10)}\n`
        message += `   👤 ${k.issued_by_name || "Unknown"} (@${k.issued_by_username || "unknown"})\n`
      }
    }

    if (used.length > 0) {
      message += `\n📤 <b>Использованные (${used.length}):</b>\n`
      for (const k of used) {
        message += `\n<code>${k.key.slice(0, 16)}...</code>\n`
        message += `   📅 ${k.issue_date.slice(0, 10)}\n`
        message += `   ✅ ${k.used_date?.slice(0, 10) || "?"}\n`
      }
    }

    const { InlineKeyboard } = await import("grammy")
    const kb = new InlineKeyboard()
    for (const k of unused) {
      kb.text(`Отозвать ${k.key.slice(0, 8)}...`, `admin_key_revoke_confirm_${k.id}`).row()
    }
    kb.text("Назад", "admin_back")

    ctx.editMessageText(message, { reply_markup: kb, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery(/^admin_key_revoke_confirm_(\d+)$/, async (ctx) => {
  if (ctx.session.adminLogin) {
    const keyId = Number(ctx.match[1])
    const revoked = await revokeAdminKey(keyId)
    if (!revoked) {
      return ctx.editMessageText("❌ <b>Ошибка</b>\n\nНе удалось отозвать ключ. Возможно, он уже удалён.", { reply_markup: adminBackKeyboard, parse_mode: "HTML" })
    }
    let message = `✅ <b>Ключ отозван</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Ключ <code>${revoked.key.slice(0, 12)}...</code> успешно удалён.`
    ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_back", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🛡️ <b>Панель управления</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Добро пожаловать, ${ctx.from.first_name}!\n\n`
    message += `Выберите раздел для управления:`
    ctx.editMessageText(message, { reply_markup: adminKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsub", async (ctx) => {
  if (ctx.session.adminLogin) {
    const subs = await getEventSubList()
    log.info(`${ctx.from.id} opened EventSub control`, { total: subs.length })
    let message = `🟣 <b>EventSub Control</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Активных событий: <b>${subs.length}</b>\n`
    if (subs.length > 0) {
      message += `\n`
      for (const sub of subs) {
        const icon = sub.status === "enabled" ? "✅" : "⚠️"
        message += `${icon} <code>${sub.type}</code>\n`
        message += `   ID: <code>${sub.id.slice(0, 16)}...</code>\n`
        message += `   Статус: ${sub.status}\n`
        if (sub.condition.broadcaster_user_id) {
          message += `   Канал ID: <code>${sub.condition.broadcaster_user_id}</code>\n`
        }
      }
    }
    ctx.editMessageText(message, { reply_markup: eventsubControlKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsubreload_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔄 <b>Перезапуск EventSub</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `⏳ Выполняется перезапуск...\n\n`
    message += `• Удаление текущих подписок\n`
    message += `• Создание новых подписок`
    ctx.editMessageText(message, {parse_mode: "HTML"})
    const subs = await getEventSubList()
    await deleteSubs(subs)
    await sleep(2500)
    await subscribeAllStreamsOnline()
    await subscribeAllStreamsOffline()
    const newSubs = await getEventSubList()
    log.warn(`${ctx.from.id} reloaded EventSub`, { before: subs.length, after: newSubs.length })
    let successMessage = `✅ <b>EventSub перезапущен</b>\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Подписок до: <b>${subs.length}</b> → после: <b>${newSubs.length}</b>`
    ctx.editMessageText(successMessage, { reply_markup: eventsubResultKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsub_disconnect", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `❌ <b>Отключение EventSub</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `⏳ Удаление всех подписок...`
    ctx.editMessageText(message, {parse_mode: "HTML"})
    const subs = await getEventSubList()
    await deleteSubs(subs)
    log.warn(`${ctx.from.id} disconnected EventSub`, { deleted: subs.length })
    let successMessage = `✅ <b>EventSub отключён</b>\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Удалено подписок: <b>${subs.length}</b>`
    ctx.editMessageText(successMessage, { reply_markup: eventsubResultKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_eventsub_cleanup", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🧹 <b>Очистка EventSub</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `⏳ Поиск неиспользуемых событий...`
    ctx.editMessageText(message, {parse_mode: "HTML"})
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
      return ctx.editMessageText(`✅ <b>Нет неиспользуемых событий</b>\n\nВсе ${subs.length} событий имеют активные подписки.`, { reply_markup: eventsubControlKeyboard, parse_mode: "HTML" })
    }
    await deleteSubs(orphaned)
    log.warn(`${ctx.from.id} EventSub cleanup`, { total: subs.length, removed: orphaned.length, remaining: subs.length - orphaned.length })
    let successMessage = `✅ <b>Очистка завершена</b>\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Всего событий: <b>${subs.length}</b>\n`
    successMessage += `Удалено неиспользуемых: <b>${orphaned.length}</b>\n`
    successMessage += `Осталось: <b>${subs.length - orphaned.length}</b>`
    ctx.editMessageText(successMessage, { reply_markup: eventsubResultKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhook", async (ctx) => {
  if (ctx.session.adminLogin) {
    const subs = await getKickSubscriptions()
    log.info(`${ctx.from.id} opened Webhook control`, { total: subs.length })
    let message = `🟢 <b>Webhook Control</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Активных вебхуков: <b>${subs.length}</b>\n`
    if (subs.length > 0) {
      message += `\n`
      for (const sub of subs) {
        message += `📌 <code>${sub.event}</code>\n`
        message += `   ID: <code>${sub.id}</code>\n`
        message += `   Канал ID: <code>${sub.broadcaster_user_id}</code>\n`
        message += `   Создан: ${sub.created_at}\n`
      }
    }
    ctx.editMessageText(message, { reply_markup: webhookControlKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhookreload_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔄 <b>Перезапуск Webhooks</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `⏳ Выполняется перезапуск...\n\n`
    message += `• Удаление текущих вебхуков\n`
    message += `• Создание новых вебхуков`
    ctx.editMessageText(message, {parse_mode: "HTML"})
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
    let successMessage = `✅ <b>Webhooks перезапущены</b>\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Вебхуков до: <b>${subs.length}</b> → после: <b>${newSubs.length}</b>`
    ctx.editMessageText(successMessage, {reply_markup: webhookResultKeyboard, parse_mode: "HTML"})
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhook_disconnect", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `❌ <b>Отключение Webhooks</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `⏳ Удаление всех вебхуков...`
    ctx.editMessageText(message, {parse_mode: "HTML"})
    const subs = await getKickSubscriptions()
    for (const sub of subs) {
      await deleteKickSubscription(sub)
    }
    log.warn(`${ctx.from.id} disconnected Webhooks`, { deleted: subs.length })
    let successMessage = `✅ <b>Webhooks отключены</b>\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Удалено вебхуков: <b>${subs.length}</b>`
    ctx.editMessageText(successMessage, { reply_markup: webhookResultKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_webhook_cleanup", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🧹 <b>Очистка Webhooks</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `⏳ Поиск неиспользуемых вебхуков...`
    ctx.editMessageText(message, {parse_mode: "HTML"})
    const subs = await getKickSubscriptions()
    const orphaned = []
    for (const sub of subs) {
      const follows = await getChannelFollowersByChannelIdAndPlatform(Number(sub.broadcaster_user_id), "kick")
      if (follows.length === 0) orphaned.push(sub)
    }
    if (orphaned.length === 0) {
      log.info(`${ctx.from.id} Webhook cleanup - nothing to remove`, { total: subs.length })
      return ctx.editMessageText(`✅ <b>Нет неиспользуемых вебхуков</b>\n\nВсе ${subs.length} вебхуков имеют активные подписки.`, { reply_markup: webhookControlKeyboard, parse_mode: "HTML" })
    }
    for (const sub of orphaned) {
      await deleteKickSubscription(sub)
    }
    log.warn(`${ctx.from.id} Webhook cleanup`, { total: subs.length, removed: orphaned.length, remaining: subs.length - orphaned.length })
    let successMessage = `✅ <b>Очистка завершена</b>\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Всего вебхуков: <b>${subs.length}</b>\n`
    successMessage += `Удалено неиспользуемых: <b>${orphaned.length}</b>\n`
    successMessage += `Осталось: <b>${subs.length - orphaned.length}</b>`
    ctx.editMessageText(successMessage, { reply_markup: webhookResultKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("admin_follows", async (ctx) => {
  if (ctx.session.adminLogin) {
    const follows = await getAllFollowsWithDetails()
    if (follows.length < 1) {
      return ctx.editMessageText("📭 <b>Нет активных подписок</b>\n\nПока ни один пользователь не отслеживает каналы.", { reply_markup: adminBackKeyboard, parse_mode: "HTML" })
    }

    const grouped = new Map<string, typeof follows>()
    for (const follow of follows) {
      const key = `${follow.platform}:${follow.channel_name}`
      const arr = grouped.get(key) || []
      arr.push(follow)
      grouped.set(key, arr)
    }

    let message = `📊 <b>Активные подписки</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `${follows.length} подписок на ${grouped.size} канал(ах)\n`
    for (const [key, subs] of grouped) {
      const platform = subs[0].platform
      const channel = subs[0].channel_name
      const platformIcon = platform === "twitch" ? "🟣" : "🟢"
      message += `\n${platformIcon} <b>${channel}</b>\n`
      message += `   ${subs.length} подписано:\n`
      for (const sub of subs) {
        message += `   👤 ${sub.first_name || "Unknown"} (@${sub.username || "unknown"})\n`
        message += `      📅 ${sub.created.slice(0, 10)}\n`
      }
    }
    ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "HTML" })
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
})

router.callbackQuery("platform_back", async (ctx) => {
  let message = `🏠 <b>TwNotifier</b>\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `Бот для отслеживания стримов\n\n`
  message += `📌 <b>Команды:</b>\n`
  message += `• /add канал — добавить канал\n`
  message += `• /remove канал — удалить канал\n`
  message += `• /list — мои подписки`
  await ctx.editMessageText(message, { reply_markup: await buildHomeKeyboard(ctx.from.id), parse_mode: "HTML" });
  ctx.session.pendingPlatformSelect = undefined
});

router.callbackQuery("platform_twitch", async (ctx) => {
  const channel_id = Number(ctx.session.pendingPlatformSelect?.twitchData.id!)
  const display_name = ctx.session.pendingPlatformSelect?.twitchData.display_name.toLowerCase()!

  if (!ctx.from) {
    return ctx.editMessageText("❌ <b>Ошибка</b>\n\nНе удалось определить пользователя.", { parse_mode: "HTML", reply_markup: backHomeKeyboard });
  }

  if (await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, "twitch")) {
    return ctx.editMessageText(`ℹ️ <b>Уже отслеживаете</b>\n\nВы уже отслеживаете ${display_name}`, { parse_mode: "HTML", reply_markup: backHomeKeyboard });
  }

  // Store pending channel in session
  ctx.session.pendingAdd = {
    channelId: channel_id,
    channelName: display_name,
    displayName: display_name,
    platform: "twitch"
  };

  // Show preview with confirmation buttons
  let previewMessage = `📺 <b>Добавление канала</b>\n`
  previewMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
  previewMessage += `Имя: <b>${display_name}</b>\n`
  previewMessage += `Платформа: 🟣 Twitch\n`
  previewMessage += `Ссылка: https://twitch.tv/${display_name}\n\n`
  previewMessage += `Продолжить добавление?`

  log.info("showing channel preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id,
    platform: "twitch"
  });

  return await ctx.editMessageText(previewMessage, {
    reply_markup: addConfirmationKeyboard,
    parse_mode: "HTML",
  });
})

router.callbackQuery("platform_kick", async (ctx) => {
  const channel_id = Number(ctx.session.pendingPlatformSelect?.kickData.data[0].broadcaster_user_id!)
  const display_name = ctx.session.pendingPlatformSelect?.kickData.data[0].slug.toLowerCase()!

  if (!ctx.from) {
    return ctx.editMessageText("❌ <b>Ошибка</b>\n\nНе удалось определить пользователя.", { parse_mode: "HTML", reply_markup: backHomeKeyboard });
  }

  if (await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, "kick")) {
    return ctx.editMessageText(`ℹ️ <b>Уже отслеживаете</b>\n\nВы уже отслеживаете ${display_name}`, { parse_mode: "HTML", reply_markup: backHomeKeyboard });
  }

  // Store pending channel in session
  ctx.session.pendingAdd = {
    channelId: channel_id,
    channelName: display_name,
    displayName: display_name,
    platform: "kick"
  };

  // Show preview with confirmation buttons
  let previewMessage = `📺 <b>Добавление канала</b>\n`
  previewMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
  previewMessage += `Имя: <b>${display_name}</b>\n`
  previewMessage += `Платформа: 🟢 Kick\n`
  previewMessage += `Ссылка: https://kick.com/${display_name}\n\n`
  previewMessage += `Продолжить добавление?`

  log.info("showing channel preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id,
    platform: "kick"
  });

  return await ctx.editMessageText(previewMessage, {
    reply_markup: addConfirmationKeyboard,
    parse_mode: "HTML",
  });
})

router.callbackQuery("remove_platform_kick", async (ctx) => {
  if (!ctx.session.removePendingPlatformSelect) {
    await ctx.answerCallbackQuery(
      "Сессия истекла. Пожалуйста, начните удаление заново.",
    );
    await ctx.editMessageText(
      "⏱️ <b>Сессия истекла</b>\n\nИспользуйте /remove для удаления канала.",
      { parse_mode: "HTML" },
    );
    return;
  }

  const { kickChannel } = ctx.session.removePendingPlatformSelect;

  await ctx.answerCallbackQuery("Удаляем канал...");

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, kickChannel.channel_id, "kick");

  // Clear pending removal
  ctx.session.removePendingPlatformSelect = undefined;

  await ctx.editMessageText(`✅ <b>Канал удалён</b>\n\n${kickChannel.channel_name} удалён из отслеживаемых.`, { parse_mode: "HTML", reply_markup: backHomeKeyboard });
  log.info("follow removed", {
    userId: ctx.from.id,
    channel: kickChannel.channel_name,
    channelId: kickChannel.channel_id,
    platform: "kick"
  });
})

router.callbackQuery("remove_platform_twitch", async (ctx) => {
  if (!ctx.session.removePendingPlatformSelect) {
    await ctx.answerCallbackQuery(
      "Сессия истекла. Пожалуйста, начните удаление заново.",
    );
    await ctx.editMessageText(
      "⏱️ <b>Сессия истекла</b>\n\nИспользуйте /remove для удаления канала.",
      { parse_mode: "HTML" },
    );
    return;
  }

  const { twitchChannel } = ctx.session.removePendingPlatformSelect;

  await ctx.answerCallbackQuery("Удаляем канал...");

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, twitchChannel.channel_id, "twitch");

  // Clear pending removal
  ctx.session.removePendingPlatformSelect = undefined;

  await ctx.editMessageText(`✅ <b>Канал удалён</b>\n\n${twitchChannel.channel_name} удалён из отслеживаемых.`, { parse_mode: "HTML", reply_markup: backHomeKeyboard });
  log.info("follow removed", {
    userId: ctx.from.id,
    channel: twitchChannel.channel_name,
    channelId: twitchChannel.channel_id,
    platform: "twitch"
  });
})

router.callbackQuery("remove_platform_back", async (ctx) => {
  if (ctx.session.removePendingPlatformSelect) {
    const { twitchChannel, kickChannel } = ctx.session.removePendingPlatformSelect;
    ctx.session.removePendingPlatformSelect = undefined;
    await ctx.answerCallbackQuery("Удаление отменено");
    await ctx.editMessageText(`🚫 <b>Удаление отменено</b>\n\nКанал ${twitchChannel.channel_name} не удалён.`, { parse_mode: "HTML" });
    log.info("channel removal cancelled", {
      userId: ctx.from.id,
      twithchChannel: twitchChannel.channel_name,
      kickChannel: kickChannel.channel_name
    });
  } else {
    await ctx.answerCallbackQuery("Нет активного удаления");
    await ctx.editMessageText("ℹ️ <b>Нет активного процесса</b>\n\nУдаление канала не было начато.", { parse_mode: "HTML" });
  }
});

router.callbackQuery("admin_broadcast", async (ctx) => {
  if (ctx.session.adminLogin) {
    ctx.session.broadcastPending = true;
    log.warn(`${ctx.from.id} initiated broadcast`);
    let message = `📨 *Массовая рассылка*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Отправьте сообщение для рассылки всем пользователям.\n\n`
    message += `📝 Доступные форматы:\n`
    message += `• Текстовое сообщение\n`
    message += `• Фото с подписью`
    await ctx.editMessageText(message, { reply_markup: broadcastCancelKeyboard, parse_mode: "Markdown" });
  } else {
    await ctx.editMessageText("⚠️ <b>Сессия истекла</b>\n\nВойдите снова через /admin", { parse_mode: "HTML" });
  }
});

router.callbackQuery("admin_broadcast_cancel", async (ctx) => {
  if (ctx.session.adminLogin && (ctx.session.broadcastPending || ctx.session.broadcastMessage)) {
    ctx.session.broadcastPending = undefined;
    ctx.session.broadcastMessage = undefined;
    log.warn(`${ctx.from.id} cancelled broadcast`);
    let message = `🚫 *Рассылка отменена*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Массовая рассылка отменена.`
    await ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "Markdown" });
  }
});

router.callbackQuery("admin_broadcast_confirm", async (ctx) => {
  if (!ctx.session.adminLogin || !ctx.session.broadcastMessage) {
    return;
  }

  const { text, photoFileId } = ctx.session.broadcastMessage;
  ctx.session.broadcastMessage = undefined;

  log.warn(`${ctx.from.id} confirmed broadcast`, { has_photo: !!photoFileId, text_preview: (text || "").slice(0, 100) });
  let message = `📨 *Массовая рассылка*\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `⏳ Отправка сообщений пользователям...`
  await ctx.editMessageText(message, {parse_mode: "Markdown"});

  const { sent, failed } = await sendBroadcastMessage(text, photoFileId);

  log.warn(`${ctx.from.id} broadcast completed`, { sent, failed });
  let resultMessage = `✅ *Рассылка завершена*\n`
  resultMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
  resultMessage += `📨 Доставлено: *${sent}*\n`
  resultMessage += `❌ Ошибок: *${failed}*`
  await ctx.reply(resultMessage, { reply_markup: adminBackKeyboard, parse_mode: "Markdown" });
});
