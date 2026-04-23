import { Composer } from "grammy";
import { buildSettingsKeyboard, homePageKeyboard } from "./keyboards";
import {
  toggleOfflineNotificationState,
  toggleOnlineNotificationState,
} from "../database/db";
import logger from "../logger";

export const router = new Composer();

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
