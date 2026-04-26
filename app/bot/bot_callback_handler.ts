import { Composer } from "grammy";
import { buildSettingsKeyboard, homePageKeyboard } from "./keyboards";
import {
  toggleOfflineNotificationState,
  toggleOnlineNotificationState,
} from "../database/db";
import logger from "../logger";
import { MyContext } from "./bot";

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
  const newState = await toggleOnlineNotificationState(ctx.from.id);
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
  const newState = await toggleOfflineNotificationState(ctx.from.id);
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
  if (!ctx.session.pendingChannel) {
    await ctx.answerCallbackQuery("Сессия истекла. Пожалуйста, начните добавление заново.");
    await ctx.editMessageText("Сессия истекла. Используйте /add для добавления канала.");
    return;
  }
  
  const { displayName } = ctx.session.pendingChannel;
  
  await ctx.answerCallbackQuery("Добавляем канал...");
  
  // Import the addChannelToFollowList function
  const { addChannel, channelExists, updateChannelName, addFollow } = await import("../database/db");
  const { subscribeToChannelOffline, subscribeToChannelOnline } = await import("../twitchAPI/subscriptions");
  const log = logger.getSubLogger({ name: "bot:callback_handler" });
  
  const { channelId, channelName } = ctx.session.pendingChannel;
  
  // Add channel to database if not exists
  if (!channelExists.get(channelId)) {
    addChannel.get(channelId, displayName);
    log.info("new channel added", {
      channel_id: channelId,
      channel_name: displayName,
    });
  } else {
    const current_name = channelExists.get(channelId)?.channel_name;
    if (current_name !== displayName) {
      updateChannelName.run(displayName, channelId);
    }
  }
  
  // Add follow
  const now = new Date().toISOString();
  addFollow.get(ctx.from.id, channelId, now);
  
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
    ctx.session.pendingChannel = undefined;
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
    ctx.session.pendingChannel = undefined;
    return;
  }
  
  // Clear pending channel
  ctx.session.pendingChannel = undefined;
  
  await ctx.editMessageText(`✅ Готово! Теперь вы отслеживаете ${displayName}`);
  log.info("new follow", {
    userId: ctx.from.id,
    channel: displayName,
  });
});

router.callbackQuery("cancel_add", async (ctx) => {
  if (ctx.session.pendingChannel) {
    const { displayName } = ctx.session.pendingChannel;
    ctx.session.pendingChannel = undefined;
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
