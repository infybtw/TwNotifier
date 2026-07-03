import { Composer } from "grammy";
import { buildSettingsKeyboard, homePageKeyboard,  adminKeyboard, adminBackKeyboard, addConfirmationKeyboard, broadcastCancelKeyboard, broadcastConfirmKeyboard, infoBackKeyboard, eventsubReloadConfirmKeyboard, webhookReloadConfirmKeyboard, adminAddConfirmKeyboard, backHomeKeyboard } from "./keyboards";
import {
  addAdminKey,
    checkOrCreateChannel,
  checkOrCreateFollow,
  getAllAdminKeys,
  getAllFollowsWithDetails,
  getAdmins,
  getChannelByChannelId,
  getChannels,
  getChannelsByPlatform,
  getFollowByUserIdChannelIdAndPlatform,
  getFollowCount,
  getFollowsByPlatform,
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
  let message = `⚙️ *Настройки*\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `Выберите параметры уведомлений:`
  await ctx.editMessageText(message, {
    //@ts-ignore
    reply_markup: await buildSettingsKeyboard(ctx.from.id),
    parse_mode: "Markdown",
  });
});

router.callbackQuery("settingsBACK", async (ctx) => {
  let message = `🏠 *TwNotifier*\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `Бот для отслеживания стримов\n\n`
  message += `📌 *Команды:*\n`
  message += `• /add _<канал>_ — добавить канал\n`
  message += `• /remove _<канал>_ — удалить канал\n`
  message += `• /list — мои подписки`
  await ctx.editMessageText(message, { reply_markup: homePageKeyboard, parse_mode: "Markdown" });
});

router.callbackQuery("mySubscriptionsCMD", async (ctx) => {
  const user_id = ctx.from?.id;
  const kickFollows = await getFollowsByUserIdAndPlatform(user_id!, "kick");
  const twitchFollows = await getFollowsByUserIdAndPlatform(user_id!, "twitch");
  if (kickFollows.length < 1 && twitchFollows.length < 1) {
    await ctx.editMessageText("📭 *Нет подписок*\n\nВы пока не отслеживаете ни одного канала.", {
      parse_mode: "Markdown",
      reply_markup: backHomeKeyboard,
    });
    return;
  }
  const total = kickFollows.length + twitchFollows.length;
  let reply_text = `📊 *Мои подписки*\n`;
  reply_text += `━━━━━━━━━━━━━━━━━━━━\n`;
  reply_text += `Всего: *${total}*\n`;
  if (twitchFollows.length >= 1) {
    reply_text += `\n🟣 *Twitch*\n`;
    for (const sub of twitchFollows) {
      const channel = await getChannelByChannelId(sub.channel_id!);
      reply_text += `   📺 ${channel?.channel_name || `ID:${sub.channel_id}`}\n`;
      reply_text += `      📅 ${sub.created.slice(0, 10)}\n`;
    }
  }
  if (kickFollows.length >= 1) {
    reply_text += `\n🟢 *Kick*\n`;
    for (const sub of kickFollows) {
      const channel = await getChannelByChannelId(sub.channel_id!);
      reply_text += `   📺 ${channel?.channel_name || `ID:${sub.channel_id}`}\n`;
      reply_text += `      📅 ${sub.created.slice(0, 10)}\n`;
    }
  }
  await ctx.editMessageText(reply_text, { parse_mode: "Markdown", reply_markup: backHomeKeyboard });
});

router.callbackQuery("infoCMD", async (ctx) => {
  let message = `ℹ️ *О боте*\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `*TwNotifier* — бот для отслеживания стримов\n\n`
  message += `📺 *Платформы:*\n`
  message += `🟣 Twitch\n`
  message += `🟢 Kick\n\n`
  message += `📌 *Команды:*\n`
  message += `\`/add\` <имя канала> — добавить канал\n`
  message += `\`/remove\` <имя канала> — удалить канал\n`
  message += `\`/list\` — мои подписки\n\n`
  message += `🔔 Бот пришлёт уведомление, когда стример выйдет в эфир или завершит трансляцию.\n\n`
  message += `⚙️ Настройки уведомлений — в разделе «Настройки».\n\n`
  message += `[GitHub](https://github.com/infybtw/twnotifier)`
  await ctx.editMessageText(message, { reply_markup: infoBackKeyboard, parse_mode: "Markdown", disable_web_page_preview: true });
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
      "⏱️ *Сессия истекла*\n\nИспользуйте /add для добавления канала.",
      { parse_mode: "Markdown" },
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
      "❌ *Ошибка подписки*\n\nПопробуйте позже или обратитесь в тех. поддержку.",
      { parse_mode: "Markdown" },
    );
    ctx.session.pendingAdd = undefined;
    return;
  }


  if (subOfflineResCode < 0) {
    log.error("subscribe error", { subOfflineResCode });
    await ctx.editMessageText(
      "❌ *Ошибка подписки*\n\nПопробуйте позже или обратитесь в тех. поддержку.",
      { parse_mode: "Markdown" },
    );
    ctx.session.pendingAdd = undefined;
    return;
  }

  // Add follow
  try {
    const follow = (await checkOrCreateFollow(ctx.from.id, channelId, platform))
    ctx.session.pendingAdd = undefined;
    if (!follow.isNew) {
      return await ctx.editMessageText(`ℹ️ *Уже отслеживаете*\n\nВы уже отслеживаете ${displayName}`, { parse_mode: "Markdown" });
    }
    await ctx.editMessageText(`✅ *Канал добавлен*\n\nТеперь вы отслеживаете ${displayName}`, { parse_mode: "Markdown", reply_markup: backHomeKeyboard });
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
    await ctx.editMessageText(`❌ *Ошибка*\n\nУже работаем над исправлением!`, { parse_mode: "Markdown" })
  }
});

router.callbackQuery("cancel_add", async (ctx) => {
  if (ctx.session.pendingAdd) {
    await ctx.answerCallbackQuery("Добавление отменено");
    await ctx.editMessageText(`🚫 *Добавление отменено*\n\nКанал ${ctx.session.pendingAdd.displayName} не добавлен.`, { parse_mode: "Markdown" });
    log.info("channel addition cancelled", {
      userId: ctx.from.id,
      channel: ctx.session.pendingAdd.displayName,
      platform: ctx.session.pendingAdd.platform,
    });
    ctx.session.pendingAdd = undefined;
  } else {
    await ctx.answerCallbackQuery("Нет активного добавления");
    await ctx.editMessageText("ℹ️ *Нет активного процесса*\n\nДобавление канала не было начато.", { parse_mode: "Markdown" });
  }
});

router.callbackQuery("confirm_remove", async (ctx) => {
  if (!ctx.session.pendingRemove) {
    await ctx.answerCallbackQuery(
      "Сессия истекла. Пожалуйста, начните удаление заново.",
    );
    await ctx.editMessageText(
      "⏱️ *Сессия истекла*\n\nИспользуйте /remove для удаления канала.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  const { displayName, channelId, platform } = ctx.session.pendingRemove;

  await ctx.answerCallbackQuery("Удаляем канал...");

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, channelId, platform);

  // Clear pending removal
  ctx.session.pendingRemove = undefined;

  await ctx.editMessageText(`✅ *Канал удалён*\n\n${displayName} удалён из отслеживаемых.`, { parse_mode: "Markdown", reply_markup: backHomeKeyboard });
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
    await ctx.editMessageText(`🚫 *Удаление отменено*\n\nКанал ${displayName} не удалён.`, { parse_mode: "Markdown" });
    log.info("channel removal cancelled", {
      userId: ctx.from.id,
      channel: displayName,
      platform
    });
  } else {
    await ctx.answerCallbackQuery("Нет активного удаления");
    await ctx.editMessageText("ℹ️ *Нет активного процесса*\n\nУдаление канала не было начато.", { parse_mode: "Markdown" });
  }
});

//admin routes
router.callbackQuery("admin_exit", async (ctx) => {
  if (ctx.session.adminLogin) {
    ctx.session.adminLogin = undefined
    let message = `👋 *Выход из панели*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы успешно вышли из панели управления.`
    ctx.editMessageText(message, {parse_mode: "Markdown"})
    log.warn(`${ctx.from.id} exit admin system`)
  }
})

router.callbackQuery("admin_channels", async (ctx) => {
  if (ctx.session.adminLogin) {
    const channels = await getChannels()
    let message = `📺 *Управление каналами*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Всего отслеживается: *${channels.length}* канал(ов)\n\n`
    for (const channel of channels) {
      const icon = channel.platform === "twitch" ? "🟣" : "🟢"
      message += `${icon} *${channel.channel_name}*\n`
      message += `   ID: \`${channel.channel_id}\`\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard, parse_mode: "Markdown"})
  }
})

router.callbackQuery("admin_users", async (ctx) => {
  if (ctx.session.adminLogin) {
    const users = await getUsers()
    let message = `👥 *Зарегистрированные пользователи*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Всего: *${users.length}*\n\n`
    for (const user of users) {
      message += `👤 *${user.first_name}* (@${user.username})\n`
      message += `   ID: \`${user.user_id}\`\n`
      message += `   📅 ${user.created}\n\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard, parse_mode: "Markdown"})
  }
})

router.callbackQuery("admin_admins", async (ctx) => {
  if (ctx.session.adminLogin) {
    const users = await getAdmins()
    let message = `🛡️ *Администраторы системы*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Всего: *${users.length}*\n\n`
    for (const user of users) {
      message += `⚡ *${user.first_name}* (@${user.username})\n`
      message += `   ID: \`${user.user_id}\`\n`
      message += `   📅 ${user.created}\n\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard, parse_mode: "Markdown"})
  }
})

router.callbackQuery("admin_add", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔑 *Создание админ-ключа*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы собираетесь создать новый ключ администратора.\n\n`
    message += `⚠️ Ключ будет сгенерирован однократно.`
    ctx.editMessageText(message, {parse_mode: "Markdown", reply_markup: adminAddConfirmKeyboard})
  }
})

router.callbackQuery("admin_add_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    const key = randomBytes(32).toString("base64url")
    const adminKey = await addAdminKey(ctx.from.id, key)
    if (!adminKey) {
      return ctx.editMessageText("❌ *Ошибка генерации ключа*\n\nНе удалось создать админ-ключ. Попробуйте позже.", {parse_mode: "Markdown"})
    }
    let message = `✅ *Админ-ключ создан*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `||\`${adminKey.key}\`||\n\n`
    message += `📤 Передайте ключ новому администратору\n`
    message += `📌 Используйте: /becomeAdmin \`ключ\``
    ctx.editMessageText(message, {parse_mode: "Markdown", reply_markup: adminBackKeyboard})
  }
})

router.callbackQuery("admin_keys", async (ctx) => {
  if (ctx.session.adminLogin) {
    const keys = await getAllAdminKeys()
    if (keys.length < 1) {
      return ctx.editMessageText("🔑 *Админ-ключи*\n━━━━━━━━━━━━━━━━━━━━\n\nНет созданных ключей.", { reply_markup: adminBackKeyboard, parse_mode: "Markdown" })
    }

    let message = `🔑 *Админ-ключи*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Всего: *${keys.length}*\n\n`

    const unused = keys.filter(k => !k.used)
    const used = keys.filter(k => k.used)

    if (unused.length > 0) {
      message += `📥 *Доступные (${unused.length}):*\n`
      for (const k of unused) {
        message += `\n\`${k.key.slice(0, 16)}...\`\n`
        message += `   📅 ${k.issue_date.slice(0, 10)}\n`
        message += `   👤 ${k.issued_by_name || "Unknown"} (@${k.issued_by_username || "unknown"})\n`
      }
    }

    if (used.length > 0) {
      message += `\n📤 *Использованные (${used.length}):*\n`
      for (const k of used) {
        message += `\n\`${k.key.slice(0, 16)}...\`\n`
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

    ctx.editMessageText(message, { reply_markup: kb, parse_mode: "Markdown" })
  }
})

router.callbackQuery(/^admin_key_revoke_confirm_(\d+)$/, async (ctx) => {
  if (ctx.session.adminLogin) {
    const keyId = Number(ctx.match[1])
    const revoked = await revokeAdminKey(keyId)
    if (!revoked) {
      return ctx.editMessageText("❌ *Ошибка*\n\nНе удалось отозвать ключ. Возможно, он уже удалён.", { reply_markup: adminBackKeyboard, parse_mode: "Markdown" })
    }
    let message = `✅ *Ключ отозван*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Ключ \`${revoked.key.slice(0, 12)}...\` успешно удалён.`
    ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "Markdown" })
  }
})

router.callbackQuery("admin_back", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🛡️ *Панель управления*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Добро пожаловать, ${ctx.from.first_name}!\n\n`
    message += `Выберите раздел для управления:`
    ctx.editMessageText(message, { reply_markup: adminKeyboard, parse_mode: "Markdown" })
  }
})

router.callbackQuery("admin_eventsubreload", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔄 *Перезапуск EventSub*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы уверены, что хотите перезапустить Twitch EventSub?\n\n`
    message += `⚠️ Это отключит текущие подписки и создаст новые.`
    ctx.editMessageText(message, { reply_markup: eventsubReloadConfirmKeyboard, parse_mode: "Markdown" })
  }
})

router.callbackQuery("admin_eventsubreload_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔄 *Перезапуск EventSub*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `⏳ Выполняется перезапуск...\n\n`
    message += `• Удаление текущих подписок\n`
    message += `• Создание новых подписок`
    ctx.editMessageText(message, {parse_mode: "Markdown"})
    const subs = await getEventSubList()
    await deleteSubs(subs)
    await sleep(2500)
    await subscribeAllStreamsOnline()
    await subscribeAllStreamsOffline()
    let successMessage = `✅ *EventSub перезапущен*\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Все подписки успешно обновлены.`
    ctx.editMessageText(successMessage, { reply_markup: adminBackKeyboard, parse_mode: "Markdown" })
  }
})

router.callbackQuery("admin_eventsubreload_cancel", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🚫 *Действие отменено*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Перезапуск EventSub отменён.`
    ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "Markdown" })
  }
})

router.callbackQuery("admin_follows", async (ctx) => {
  if (ctx.session.adminLogin) {
    const follows = await getAllFollowsWithDetails()
    if (follows.length < 1) {
      return ctx.editMessageText("📭 *Нет активных подписок*\n\nПока ни один пользователь не отслеживает каналы.", { reply_markup: adminBackKeyboard, parse_mode: "Markdown" })
    }

    const grouped = new Map<string, typeof follows>()
    for (const follow of follows) {
      const key = `${follow.platform}:${follow.channel_name}`
      const arr = grouped.get(key) || []
      arr.push(follow)
      grouped.set(key, arr)
    }

    let message = `📊 *Активные подписки*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `${follows.length} подписок на ${grouped.size} канал(ах)\n`
    for (const [key, subs] of grouped) {
      const platform = subs[0].platform
      const channel = subs[0].channel_name
      const platformIcon = platform === "twitch" ? "🟣" : "🟢"
      message += `\n${platformIcon} *${channel}*\n`
      message += `   ${subs.length} подписано:\n`
      for (const sub of subs) {
        message += `   👤 ${sub.first_name || "Unknown"} (@${sub.username || "unknown"})\n`
        message += `      📅 ${sub.created.slice(0, 10)}\n`
      }
    }
    ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "Markdown" })
  }
})

router.callbackQuery("admin_webhookreload", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔗 *Перезапуск Webhooks*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы уверены, что хотите перезапустить Kick Webhooks?\n\n`
    message += `⚠️ Это переподключит все вебхуки Kick.`
    ctx.editMessageText(message, { reply_markup: webhookReloadConfirmKeyboard, parse_mode: "Markdown" })
  }
})

router.callbackQuery("admin_webhookreload_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔗 *Перезапуск Webhooks*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `⏳ Выполняется перезапуск...\n\n`
    message += `• Удаление текущих вебхуков\n`
    message += `• Создание новых вебхуков`
    ctx.editMessageText(message, {parse_mode: "Markdown"})
    const subs = await getKickSubscriptions()
    const dbSubs = await getChannelsByPlatform("kick")
    if (subs.length > 0) {
      for (const sub of subs) {
        await deleteKickSubscription(sub)
      }
      await sleep(2500)
      for (const sub of dbSubs) {
        await subscribeToKickChannelOnline(sub.channel_id!)
      }
    }
    let successMessage = `✅ *Webhooks перезапущены*\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Все вебхуки Kick успешно обновлены.`
    ctx.editMessageText(successMessage, {reply_markup: adminBackKeyboard, parse_mode: "Markdown"})
  }
})

router.callbackQuery("admin_webhookreload_cancel", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🚫 *Действие отменено*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Перезапуск Webhooks отменён.`
    ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "Markdown" })
  }
})

router.callbackQuery("platform_back", async (ctx) => {
  let message = `🏠 *TwNotifier*\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `Бот для отслеживания стримов\n\n`
  message += `📌 *Команды:*\n`
  message += `• /add _<канал>_ — добавить канал\n`
  message += `• /remove _<канал>_ — удалить канал\n`
  message += `• /list — мои подписки`
  await ctx.editMessageText(message, { reply_markup: homePageKeyboard, parse_mode: "Markdown" });
  ctx.session.pendingPlatformSelect = undefined
});

router.callbackQuery("platform_twitch", async (ctx) => {
  const channel_id = Number(ctx.session.pendingPlatformSelect?.twitchData.id!)
  const display_name = ctx.session.pendingPlatformSelect?.twitchData.display_name.toLowerCase()!

  if (!ctx.from) {
    return ctx.editMessageText("❌ *Ошибка*\n\nНе удалось определить пользователя.", { parse_mode: "Markdown", reply_markup: backHomeKeyboard });
  }

  if (await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, "twitch")) {
    return ctx.editMessageText(`ℹ️ *Уже отслеживаете*\n\nВы уже отслеживаете ${display_name}`, { parse_mode: "Markdown", reply_markup: backHomeKeyboard });
  }

  // Store pending channel in session
  ctx.session.pendingAdd = {
    channelId: channel_id,
    channelName: display_name,
    displayName: display_name,
    platform: "twitch"
  };

  // Show preview with confirmation buttons
  let previewMessage = `📺 *Добавление канала*\n`
  previewMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
  previewMessage += `Имя: *${display_name}*\n`
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
    parse_mode: "Markdown",
  });
})

router.callbackQuery("platform_kick", async (ctx) => {
  const channel_id = Number(ctx.session.pendingPlatformSelect?.kickData.data[0].broadcaster_user_id!)
  const display_name = ctx.session.pendingPlatformSelect?.kickData.data[0].slug.toLowerCase()!

  if (!ctx.from) {
    return ctx.editMessageText("❌ *Ошибка*\n\nНе удалось определить пользователя.", { parse_mode: "Markdown", reply_markup: backHomeKeyboard });
  }

  if (await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, "kick")) {
    return ctx.editMessageText(`ℹ️ *Уже отслеживаете*\n\nВы уже отслеживаете ${display_name}`, { parse_mode: "Markdown", reply_markup: backHomeKeyboard });
  }

  // Store pending channel in session
  ctx.session.pendingAdd = {
    channelId: channel_id,
    channelName: display_name,
    displayName: display_name,
    platform: "kick"
  };

  // Show preview with confirmation buttons
  let previewMessage = `📺 *Добавление канала*\n`
  previewMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
  previewMessage += `Имя: *${display_name}*\n`
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
    parse_mode: "Markdown",
  });
})

router.callbackQuery("remove_platform_kick", async (ctx) => {
  if (!ctx.session.removePendingPlatformSelect) {
    await ctx.answerCallbackQuery(
      "Сессия истекла. Пожалуйста, начните удаление заново.",
    );
    await ctx.editMessageText(
      "⏱️ *Сессия истекла*\n\nИспользуйте /remove для удаления канала.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  const { kickChannel } = ctx.session.removePendingPlatformSelect;

  await ctx.answerCallbackQuery("Удаляем канал...");

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, kickChannel.channel_id, "kick");

  // Clear pending removal
  ctx.session.removePendingPlatformSelect = undefined;

  await ctx.editMessageText(`✅ *Канал удалён*\n\n${kickChannel.channel_name} удалён из отслеживаемых.`, { parse_mode: "Markdown", reply_markup: backHomeKeyboard });
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
      "⏱️ *Сессия истекла*\n\nИспользуйте /remove для удаления канала.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  const { twitchChannel } = ctx.session.removePendingPlatformSelect;

  await ctx.answerCallbackQuery("Удаляем канал...");

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, twitchChannel.channel_id, "twitch");

  // Clear pending removal
  ctx.session.removePendingPlatformSelect = undefined;

  await ctx.editMessageText(`✅ *Канал удалён*\n\n${twitchChannel.channel_name} удалён из отслеживаемых.`, { parse_mode: "Markdown", reply_markup: backHomeKeyboard });
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
    await ctx.editMessageText(`🚫 *Удаление отменено*\n\nКанал ${twitchChannel.channel_name} не удалён.`, { parse_mode: "Markdown" });
    log.info("channel removal cancelled", {
      userId: ctx.from.id,
      twithchChannel: twitchChannel.channel_name,
      kickChannel: kickChannel.channel_name
    });
  } else {
    await ctx.answerCallbackQuery("Нет активного удаления");
    await ctx.editMessageText("ℹ️ *Нет активного процесса*\n\nУдаление канала не было начато.", { parse_mode: "Markdown" });
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
