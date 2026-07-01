import { Composer } from "grammy";
import { buildSettingsKeyboard, homePageKeyboard,  adminKeyboard, adminBackKeyboard, addConfirmationKeyboard, broadcastCancelKeyboard, broadcastConfirmKeyboard } from "./keyboards";
import {
  addAdminKey,
    checkOrCreateChannel,
  checkOrCreateFollow,
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
    await ctx.editMessageText("Вы вышли из системы администрирования")
    log.warn(`${ctx.from.id} exit admin system`)
  }
})

router.callbackQuery("admin_channels", async (ctx) => {
  if (ctx.session.adminLogin) {
    const channels = await getChannels()
    let message = `Всего активно ${channels.length} каналов:\n`
    for (const channel of channels) {
      message += `<b>${channel.platform}</b>/${channel.channel_name} - ${channel.channel_id}\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard, parse_mode: "HTML"})
  }
})

router.callbackQuery("admin_users", async (ctx) => {
  if (ctx.session.adminLogin) {
    const users = await getUsers()
    let message = `Зарегестрированно ${users.length} пользователей:\n`
    for (const user of users) {
      message += `${user.user_id} - ${user.first_name}(${user.username})\nДата регистрации: ${user.created}\n\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard})
  }
})

router.callbackQuery("admin_admins", async (ctx) => {
  if (ctx.session.adminLogin) {
    const users = await getAdmins()
    let message = `Зарегестрированно ${users.length} админов:\n`
    for (const user of users) {
      message += `${user.user_id} - ${user.first_name}(${user.username})\nДата регистрации: ${user.created}\n\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard})
  }
})

router.callbackQuery("admin_add", async (ctx) => {
  if (ctx.session.adminLogin) {
    const key = randomBytes(32).toString("base64url")
    const adminKey = await addAdminKey(ctx.from.id, key)
    if (!adminKey) {
      return ctx.editMessageText("Произошла ошибка при гененрации Админ-Ключа")
    }
    ctx.editMessageText(`Админ ключ успешно сгененерирован\n\n<tg-spoiler>${adminKey.key}</tg-spoiler>`, {parse_mode: "HTML", reply_markup: adminBackKeyboard})
  }
})

router.callbackQuery("admin_back", async (ctx) => {
  if (ctx.session.adminLogin) {
    ctx.editMessageText("Вы вошли в систему администрирования", { reply_markup: adminKeyboard })
  }
})

router.callbackQuery("admin_eventsubreload", async (ctx) => {
  if (ctx.session.adminLogin) {
    ctx.editMessageText("Eventsub перезапускается, подождите")
    const subs = await getEventSubList()
    await deleteSubs(subs)
    await sleep(2500)
    await subscribeAllStreamsOnline()
    await subscribeAllStreamsOffline()
    ctx.editMessageText("Eventsub успешно перезапущен", { reply_markup: adminBackKeyboard })
  }
})

router.callbackQuery("admin_follows", async (ctx) => {
  if (ctx.session.adminLogin) {
    const follows = await getAllFollowsWithDetails()
    if (follows.length < 1) {
      return ctx.editMessageText("Нет активных подписок", { reply_markup: adminBackKeyboard })
    }

    const grouped = new Map<string, typeof follows>()
    for (const follow of follows) {
      const key = `${follow.platform}:${follow.channel_name}`
      const arr = grouped.get(key) || []
      arr.push(follow)
      grouped.set(key, arr)
    }

    let message = `Всего ${follows.length} подписок, ${grouped.size} каналов:\n`
    for (const [key, subs] of grouped) {
      const platform = subs[0].platform
      const channel = subs[0].channel_name
      const platformIcon = platform === "twitch" ? "🟣" : "🟢"
      message += `\n${platformIcon} <b>${channel}</b> (${platform})\n`
      for (const sub of subs) {
        message += `   👤 ${sub.first_name || "Unknown"} (@${sub.username || "unknown"}) - ${sub.created.slice(0, 10)}\n`
      }
    }
    ctx.editMessageText(message, { reply_markup: adminBackKeyboard, parse_mode: "HTML" })
  }
})

router.callbackQuery("admin_webhookreload", async (ctx) => {
  if (ctx.session.adminLogin) {
    ctx.editMessageText("Webhooks перезапускаются, подождите")
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
    ctx.editMessageText("Webhooks успешно перезапущены.", {reply_markup: adminBackKeyboard})
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
    await ctx.editMessageText(
      "Отправьте сообщение для рассылки (текст или фото с подписью)",
      { reply_markup: broadcastCancelKeyboard },
    );
  }
});

router.callbackQuery("admin_broadcast_cancel", async (ctx) => {
  if (ctx.session.adminLogin && (ctx.session.broadcastPending || ctx.session.broadcastMessage)) {
    ctx.session.broadcastPending = undefined;
    ctx.session.broadcastMessage = undefined;
    log.warn(`${ctx.from.id} cancelled broadcast`);
    await ctx.editMessageText("Рассылка отменена", { reply_markup: adminBackKeyboard });
  }
});

router.callbackQuery("admin_broadcast_confirm", async (ctx) => {
  if (!ctx.session.adminLogin || !ctx.session.broadcastMessage) {
    return;
  }

  const { text, photoFileId } = ctx.session.broadcastMessage;
  ctx.session.broadcastMessage = undefined;

  log.warn(`${ctx.from.id} confirmed broadcast`, { has_photo: !!photoFileId, text_preview: (text || "").slice(0, 100) });
  await ctx.editMessageText("Рассылка началась...");

  const { sent, failed } = await sendBroadcastMessage(text, photoFileId);

  log.warn(`${ctx.from.id} broadcast completed`, { sent, failed });
  await ctx.reply(
    `Рассылка завершена.\n✅ Успешно: ${sent}\n❌ Ошибок: ${failed}`,
    { reply_markup: adminBackKeyboard },
  );
});
