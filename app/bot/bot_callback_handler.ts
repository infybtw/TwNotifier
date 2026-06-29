import { Composer } from "grammy";
import { buildSettingsKeyboard, homePageKeyboard,  adminKeyboard, adminBackKeyboard, addConfirmationKeyboard, } from "./keyboards";
import {
  addAdminKey,
    checkOrCreateChannel,
  checkOrCreateFollow,
  getAdmins,
  getChannelByChannelId,
  getChannels,
  getFollowByUserIdChannelIdAndPlatform,
  getFollowCount,
  getUsers,
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
    console.log("kick sub")
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
  const now = new Date().toISOString();
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
    const { displayName } = ctx.session.pendingAdd;
    ctx.session.pendingAdd = undefined;
    await ctx.answerCallbackQuery("Добавление отменено");
    await ctx.editMessageText(`❌ Добавление канала ${displayName} отменено.`);
    log.info("channel addition cancelled", {
      userId: ctx.from.id,
      channel: displayName,
    });
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

  const { displayName, channelId } = ctx.session.pendingRemove;

  await ctx.answerCallbackQuery("Удаляем канал...");

  // Import required functions
  const { removeFollowByUserIdAndChannelId } = await import("../database/db");
  const log = logger.getSubLogger({ name: "bot:callback_handler" });

  // Remove the follow
  //@ts-ignore
  await removeFollowByUserIdAndChannelId(ctx.from.id, channelId);

  // Clear pending removal
  ctx.session.pendingRemove = undefined;

  await ctx.editMessageText(`✅ Канал ${displayName} удален из отслеживаемых.`);
  log.info("channel removed", {
    userId: ctx.from.id,
    channel: displayName,
    channelId: channelId,
  });
});

router.callbackQuery("cancel_remove", async (ctx) => {
  if (ctx.session.pendingRemove) {
    const { displayName } = ctx.session.pendingRemove;
    ctx.session.pendingRemove = undefined;
    await ctx.answerCallbackQuery("Удаление отменено");
    await ctx.editMessageText(`❌ Удаление канала ${displayName} отменено.`);
    log.info("channel removal cancelled", {
      userId: ctx.from.id,
      channel: displayName,
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
      message += `${channel.channel_name} - ${channel.channel_id}\n`
    }
    ctx.editMessageText(message, {reply_markup: adminBackKeyboard})
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
    if (!addAdminKey) {
      return ctx.editMessageText("Произошла ошибка при гененрации Админ-Ключа")
    }
    ctx.editMessageText(`Админ ключ успешно сгененерирован\n\n<tg-spoiler>${adminKey.key}</tg-spoiler>`, {parse_mode: "HTML", reply_markup: adminBackKeyboard})
  }
})

router.callbackQuery("admin_back", async (ctx) => {
  ctx.editMessageText("Вы вошли в систему администрирования", {reply_markup: adminKeyboard})
})

router.callbackQuery("admin_eventsubreload", async (ctx) => {
  ctx.editMessageText("Eventsub перезапускается, подождите")
  const subs = await getEventSubList()
  await deleteSubs(subs)
  await sleep(2500)
  await subscribeAllStreamsOnline()
  await subscribeAllStreamsOffline()
  ctx.editMessageText("Eventsub успешно перезапущен", {reply_markup: adminBackKeyboard})
})

router.callbackQuery("admin_follows", async (ctx) => {
  const followCount = await getFollowCount()
  ctx.editMessageText(`Всего ${followCount} подписок `,{reply_markup: adminBackKeyboard})
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
  const display_name = ctx.session.pendingPlatformSelect?.twitchData.display_name!

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
  const display_name = ctx.session.pendingPlatformSelect?.kickData.data[0].slug!

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
