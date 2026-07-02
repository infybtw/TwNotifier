import { Composer } from "grammy";
import { buildSettingsKeyboard, homePageKeyboard,  adminKeyboard, adminBackKeyboard, addConfirmationKeyboard, broadcastCancelKeyboard, broadcastConfirmKeyboard, infoBackKeyboard, eventsubReloadConfirmKeyboard, webhookReloadConfirmKeyboard, adminAddConfirmKeyboard } from "./keyboards";
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
  await ctx.editMessageText("Настройки", {
    //@ts-ignore
    reply_markup: await buildSettingsKeyboard(ctx.from.id),
  });
});

router.callbackQuery("settingsBACK", async (ctx) => {
  await ctx.editMessageText(
    "Добро пожаловать в TwNotifier\n\nИспользование:\n/add <канал> - Добавить канал\n/remove <канал> - Удалить канал из отслеживаемых\n/list - Список моих каналов",
    { reply_markup: homePageKeyboard },
  );
});

router.callbackQuery("infoCMD", async (ctx) => {
  await ctx.editMessageText(
    "*TwNotifier* — бот для отслеживания стримов\n\n" +
    "Поддерживаемые платформы:\n" +
    "🟣 _Twitch_\n" +
    "🟢 _Kick_\n\n" +
    "Команды:\n" +
    "`/add` _<имя канала>_ — добавить канал\n" +
    "`/remove` _<имя канала>_ — удалить канал\n" +
    "`/list` — мои подписки\n\n" +
    "Бот пришлёт уведомление, когда стример выйдет в эфир или завершит трансляцию.\n\n" +
    "Настройки уведомлений — в разделе «Настройки».\n\n" +
    "[GitHub](https://github.com/infybtw/twnotifier)",
    { reply_markup: infoBackKeyboard, parse_mode: "Markdown", disable_web_page_preview: true },
  );
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
      "Сессия истекла. Используйте /add для добавления канала.",
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
      "Ошибка подписки, попробуйте позже или обратитесь в тех.поддержку.",
    );
    ctx.session.pendingAdd = undefined;
    return;
  }


  if (subOfflineResCode < 0) {
    log.error("subscribe error", { subResponseCode: subOfflineResCode });
    await ctx.editMessageText(
      "Ошибка подписки, попробуйте позже или обратитесь в тех.поддержку.",
    );
    ctx.session.pendingAdd = undefined;
    return;
  }

  // Add follow
  try {
    const follow = (await checkOrCreateFollow(ctx.from.id, channelId, platform))
    ctx.session.pendingAdd = undefined;
    if (!follow.isNew) {
      return await ctx.editMessageText(`✅ Вы уже отслеживаете ${displayName}`);
    }
    await ctx.editMessageText(`✅ Готово! Теперь вы отслеживаете ${displayName}`);
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
    await ctx.editMessageText(`⛔ Упс, произошла ошибка. Уже работаем над ее исправлением!`)
  }
});

router.callbackQuery("cancel_add", async (ctx) => {
  if (ctx.session.pendingAdd) {
    await ctx.answerCallbackQuery("Добавление отменено");
    await ctx.editMessageText(`❌ Добавление канала ${ctx.session.pendingAdd.displayName} отменено.`);
    log.info("channel addition cancelled", {
      userId: ctx.from.id,
      channel: ctx.session.pendingAdd.displayName,
      platform: ctx.session.pendingAdd.platform,
    });
    ctx.session.pendingAdd = undefined;
  } else {
    await ctx.answerCallbackQuery("Нет активного добавления");
    await ctx.editMessageText("Нет активного процесса добавления канала.");
  }
});

router.callbackQuery("confirm_remove", async (ctx) => {
  if (!ctx.session.pendingRemove) {
    await ctx.answerCallbackQuery(
      "Сессия истекла. Пожалуйста, начните удаление заново.",
    );
    await ctx.editMessageText(
      "Сессия истекла. Используйте /remove для удаления канала.",
    );
    return;
  }

  const { displayName, channelId, platform } = ctx.session.pendingRemove;

  await ctx.answerCallbackQuery("Удаляем канал...");

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, channelId, platform);

  // Clear pending removal
  ctx.session.pendingRemove = undefined;

  await ctx.editMessageText(`✅ Канал ${displayName} удален из отслеживаемых.`);
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
    await ctx.editMessageText(`❌ Удаление канала ${displayName} отменено.`);
    log.info("channel removal cancelled", {
      userId: ctx.from.id,
      channel: displayName,
      platform
    });
  } else {
    await ctx.answerCallbackQuery("Нет активного удаления");
    await ctx.editMessageText("Нет активного процесса удаления канала.");
  }
});

//admin routes
router.callbackQuery("admin_exit", async (ctx) => {
  if (ctx.session.adminLogin) {
    ctx.session.adminLogin = undefined
    let message = `👋 <b>Выход из панели</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы успешно вышли из панели управления.`
    ctx.editMessageText(message, {parse_mode: "HTML"})
    log.warn(`${ctx.from.id} exit admin system`)
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
  }
})

router.callbackQuery("admin_add", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔑 <b>Создание админ-ключа</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы собираетесь создать новый ключ администратора.\n\n`
    message += `⚠️ Ключ будет сгенерирован однократно.`
    ctx.editMessageText(message, {parse_mode: "HTML", reply_markup: adminAddConfirmKeyboard})
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
    message += `<tg-spoiler><code>${adminKey.key}</code></tg-spoiler>\n\n`
    message += `📤 Передайте ключ новому администратору\n`
    message += `📌 Используйте: /becomeAdmin <code>ключ</code>`
    ctx.editMessageText(message, {parse_mode: "HTML", reply_markup: adminBackKeyboard})
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
  }
})

router.callbackQuery("admin_back", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🛡️ <b>Панель управления</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `Добро пожаловать, ${ctx.from.first_name}!\n\n`
    message += `Выберите раздел для управления:`
    ctx.editMessageText(message, { reply_markup: adminKeyboard, parse_mode: "HTML" })
  }
})

router.callbackQuery("admin_eventsubreload", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔄 <b>Перезапуск EventSub</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы уверены, что хотите перезапустить Twitch EventSub?\n\n`
    message += `⚠️ Это отключит текущие подписки и создаст новые.`
    ctx.editMessageText(message, { reply_markup: eventsubReloadConfirmKeyboard, parse_mode: "HTML" })
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
    let successMessage = `✅ <b>EventSub перезапущен</b>\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Все подписки успешно обновлены.`
    ctx.editMessageText(successMessage, { reply_markup: adminBackKeyboard, parse_mode: "HTML" })
  }
})

router.callbackQuery("admin_eventsubreload_cancel", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🚫 <b>Действие отменено</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Перезапуск EventSub отменён.`
    ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "HTML" })
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
  }
})

router.callbackQuery("admin_webhookreload", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔗 <b>Перезапуск Webhooks</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы уверены, что хотите перезапустить Kick Webhooks?\n\n`
    message += `⚠️ Это переподключит все вебхуки Kick.`
    ctx.editMessageText(message, { reply_markup: webhookReloadConfirmKeyboard, parse_mode: "HTML" })
  }
})

router.callbackQuery("admin_webhookreload_confirm", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🔗 <b>Перезапуск Webhooks</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `⏳ Выполняется перезапуск...\n\n`
    message += `• Удаление текущих вебхуков\n`
    message += `• Создание новых вебхуков`
    ctx.editMessageText(message, {parse_mode: "HTML"})
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
    let successMessage = `✅ <b>Webhooks перезапущены</b>\n`
    successMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    successMessage += `Все вебхуки Kick успешно обновлены.`
    ctx.editMessageText(successMessage, {reply_markup: adminBackKeyboard, parse_mode: "HTML"})
  }
})

router.callbackQuery("admin_webhookreload_cancel", async (ctx) => {
  if (ctx.session.adminLogin) {
    let message = `🚫 <b>Действие отменено</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Перезапуск Webhooks отменён.`
    ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "HTML" })
  }
})

router.callbackQuery("platform_back", async (ctx) => {
  await ctx.editMessageText(
    "Добро пожаловать в TwNotifier\n\nИспользование:\n/add <канал> - Добавить канал\n/remove <канал> - Удалить канал из отслеживаемых\n/list - Список моих каналов",
    { reply_markup: homePageKeyboard },
  );
  ctx.session.pendingPlatformSelect = undefined
});

router.callbackQuery("platform_twitch", async (ctx) => {
  const channel_id = Number(ctx.session.pendingPlatformSelect?.twitchData.id!)
  const display_name = ctx.session.pendingPlatformSelect?.twitchData.display_name.toLowerCase()!

  if (!ctx.from) {
    return ctx.reply("Ошибка: не удалось определить пользователя");
  }

  if (await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, "twitch")) {
    return ctx.reply(`Вы уже отслеживаете ${display_name}`);
  }

  // Store pending channel in session
  ctx.session.pendingAdd = {
    channelId: channel_id,
    channelName: display_name,
    displayName: display_name,
    platform: "twitch"
  };

  // Show preview with confirmation buttons
  const previewMessage =
    `Вы хотите добавить канал:\n\n` +
    `📺 Имя: ${display_name}\n` +
    `🔗 Ссылка: https://twitch.tv/${display_name}\n\n` +
    `Продолжить добавление?`;

  log.info("showing channel preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id,
    platform: "twitch"
  });

  return await ctx.editMessageText(previewMessage, {
    reply_markup: addConfirmationKeyboard,
  });
})

router.callbackQuery("platform_kick", async (ctx) => {
  const channel_id = Number(ctx.session.pendingPlatformSelect?.kickData.data[0].broadcaster_user_id!)
  const display_name = ctx.session.pendingPlatformSelect?.kickData.data[0].slug.toLowerCase()!

  if (!ctx.from) {
    return ctx.reply("Ошибка: не удалось определить пользователя");
  }

  if (await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, "kick")) {
    return ctx.reply(`Вы уже отслеживаете ${display_name}`);
  }

  // Store pending channel in session
  ctx.session.pendingAdd = {
    channelId: channel_id,
    channelName: display_name,
    displayName: display_name,
    platform: "kick"
  };

  // Show preview with confirmation buttons
  const previewMessage =
    `Вы хотите добавить канал:\n\n` +
    `📺 Имя: ${display_name}\n` +
    `🔗 Ссылка: https://kick.com/${display_name}\n\n` +
    `Продолжить добавление?`;

  log.info("showing channel preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id,
    platform: "kick"
  });

  return await ctx.editMessageText(previewMessage, {
    reply_markup: addConfirmationKeyboard,
  });
})

router.callbackQuery("remove_platform_kick", async (ctx) => {
  if (!ctx.session.removePendingPlatformSelect) {
    await ctx.answerCallbackQuery(
      "Сессия истекла. Пожалуйста, начните удаление заново.",
    );
    await ctx.editMessageText(
      "Сессия истекла. Используйте /remove для удаления канала.",
    );
    return;
  }

  const { kickChannel } = ctx.session.removePendingPlatformSelect;

  await ctx.answerCallbackQuery("Удаляем канал...");

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, kickChannel.channel_id, "kick");

  // Clear pending removal
  ctx.session.removePendingPlatformSelect = undefined;

  await ctx.editMessageText(`✅ Канал ${kickChannel.channel_name} удален из отслеживаемых.`);
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
      "Сессия истекла. Используйте /remove для удаления канала.",
    );
    return;
  }

  const { twitchChannel } = ctx.session.removePendingPlatformSelect;

  await ctx.answerCallbackQuery("Удаляем канал...");

  await removeFollowByUserIdChannelIdAndPlatfrom(ctx.from.id, twitchChannel.channel_id, "twitch");

  // Clear pending removal
  ctx.session.removePendingPlatformSelect = undefined;

  await ctx.editMessageText(`✅ Канал ${twitchChannel.channel_name} удален из отслеживаемых.`);
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
    await ctx.editMessageText(`❌ Удаление канала ${twitchChannel.channel_name} отменено.`);
    log.info("channel removal cancelled", {
      userId: ctx.from.id,
      twithchChannel: twitchChannel.channel_name,
      kickChannel: kickChannel.channel_name
    });
  } else {
    await ctx.answerCallbackQuery("Нет активного удаления");
    await ctx.editMessageText("Нет активного процесса удаления канала.");
  }
});

router.callbackQuery("admin_broadcast", async (ctx) => {
  if (ctx.session.adminLogin) {
    ctx.session.broadcastPending = true;
    log.warn(`${ctx.from.id} initiated broadcast`);
    let message = `📨 <b>Массовая рассылка</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Отправьте сообщение для рассылки всем пользователям.\n\n`
    message += `📝 Доступные форматы:\n`
    message += `• Текстовое сообщение\n`
    message += `• Фото с подписью`
    await ctx.editMessageText(message, { reply_markup: broadcastCancelKeyboard, parse_mode: "HTML" });
  }
});

router.callbackQuery("admin_broadcast_cancel", async (ctx) => {
  if (ctx.session.adminLogin && (ctx.session.broadcastPending || ctx.session.broadcastMessage)) {
    ctx.session.broadcastPending = undefined;
    ctx.session.broadcastMessage = undefined;
    log.warn(`${ctx.from.id} cancelled broadcast`);
    let message = `🚫 <b>Рассылка отменена</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Массовая рассылка отменена.`
    await ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "HTML" });
  }
});

router.callbackQuery("admin_broadcast_confirm", async (ctx) => {
  if (!ctx.session.adminLogin || !ctx.session.broadcastMessage) {
    return;
  }

  const { text, photoFileId } = ctx.session.broadcastMessage;
  ctx.session.broadcastMessage = undefined;

  log.warn(`${ctx.from.id} confirmed broadcast`, { has_photo: !!photoFileId, text_preview: (text || "").slice(0, 100) });
  let message = `📨 <b>Массовая рассылка</b>\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `⏳ Отправка сообщений пользователям...`
  await ctx.editMessageText(message, {parse_mode: "HTML"});

  const { sent, failed } = await sendBroadcastMessage(text, photoFileId);

  log.warn(`${ctx.from.id} broadcast completed`, { sent, failed });
  let resultMessage = `✅ <b>Рассылка завершена</b>\n`
  resultMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
  resultMessage += `📨 Доставлено: <b>${sent}</b>\n`
  resultMessage += `❌ Ошибок: <b>${failed}</b>`
  await ctx.reply(resultMessage, { reply_markup: adminBackKeyboard, parse_mode: "HTML" });
});
