import { Composer } from "grammy";
import { buildSettingsKeyboard, homePageKeyboard } from "./keyboards";
import {
    checkOrCreateChannel,
  checkOrCreateFollow,
  getChannelByChannelId,
} from "../database/db";
import {
  subscribeToChannelOffline,
  subscribeToChannelOnline,
} from "../twitchAPI/subscriptions";
import logger from "../logger";
import { MyContext } from "./bot";
import { toggleOfflineNotificationStateByUserId, toggleOnlineNotificationStateByUserId } from "../utils/settings";

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

  const { channelId, channelName } = ctx.session.pendingAdd;

  await checkOrCreateChannel(channelId, channelName)

  // Subscribe to events
  const subOnlineResCode = await subscribeToChannelOnline(
    channelId,
    displayName || channelName,
  );
  if (subOnlineResCode < 0) {
    log.error("subscribe error", { subResponseCode: subOnlineResCode });
    await ctx.editMessageText(
      "Ошибка подписки, попробуйте позже или обратитесь в тех.поддержку.",
    );
    ctx.session.pendingAdd = undefined;
    return;
  }

  const subOfflineResCode = await subscribeToChannelOffline(
    channelId,
    displayName || channelName,
  );
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
    const follow = (await checkOrCreateFollow(ctx.from.id, channelId))
    ctx.session.pendingAdd = undefined;
    if (!follow.isNew) {
      return await ctx.editMessageText(`✅ Вы уже отслеживаете ${displayName}`);
    }
    await ctx.editMessageText(`✅ Готово! Теперь вы отслеживаете ${displayName}`);
    log.info("new follow", {
      userId: ctx.from.id,
      channel: displayName,
    });
  } catch (err) {
    log.error("follow error", {
      userId: ctx.from.id,
      channelId: channelId,
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
