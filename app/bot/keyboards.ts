import { InlineKeyboard } from "grammy";
import { getSettingsStateByUserId } from "../database/db";

export const homePageKeyboard = new InlineKeyboard()
  .text("Настройки", "settingsCMD")
  .text("Инфо", "infoCMD");

export const addConfirmationKeyboard = new InlineKeyboard()
  .text("Продолжить", "confirm_add")
  .text("Отмена", "cancel_add");

export const removeConfirmationKeyboard = new InlineKeyboard()
  .text("Удалить", "confirm_remove")
  .text("Отмена", "cancel_remove");

export async function buildSettingsKeyboard(
  user_id: number,
): Promise<InlineKeyboard> {
  const user_settings = await getSettingsStateByUserId(user_id);
  if (!user_settings) {
    return new InlineKeyboard().text("Назад", "settingsBACK");
  }
  let onlineNotificationText = "Уведомления о начале трансляции ";
  let offlineNotificationText = "Уведомления об окончании трансляции ";
  if (user_settings?.online_notification === 1) {
    onlineNotificationText += "✅";
  } else {
    onlineNotificationText += "🚫";
  }
  if (user_settings?.offline_notification === 1) {
    offlineNotificationText += "✅";
  } else {
    offlineNotificationText += "🚫";
  }

  return new InlineKeyboard()
    .text(onlineNotificationText, "toogleOnlineNotificationCMD")
    .row()
    .text(offlineNotificationText, "toggleOfflineNotificationCMD")
    .row()
    .text("Назад", "settingsBACK");
}
