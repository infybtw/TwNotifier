import { Composer } from "grammy";
import { buildSettingsKeyboard, homePageKeyboard } from "./keyboards";
import {
  toggleOfflineNotificationState,
  toggleOnlineNotificationState,
} from "../database/db";

export const router = new Composer();

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
  toggleOnlineNotificationState(ctx.from.id);
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildSettingsKeyboard(ctx.from.id),
  });
});

router.callbackQuery("toggleOfflineNotificationCMD", async (ctx) => {
  await toggleOfflineNotificationState(ctx.from.id);
  await ctx.editMessageReplyMarkup({
    reply_markup: await buildSettingsKeyboard(ctx.from.id),
  });
});
