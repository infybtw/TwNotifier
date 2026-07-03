import { InlineKeyboard } from "grammy";
import { getSettingsStateByUserId, getUserByUserId } from "../database/db";

export async function buildHomeKeyboard(user_id: number): Promise<InlineKeyboard> {
  const user = await getUserByUserId(user_id);
  const kb = new InlineKeyboard()
    .text("Мои подписки", "mySubscriptionsCMD")
    .row()
    .text("Настройки", "settingsCMD")
    .text("Инфо", "infoCMD");
  if (user?.is_admin) {
    kb.row().text("Управление", "adminCMD");
  }
  return kb;
}

export const addConfirmationKeyboard = new InlineKeyboard()
  .text("Продолжить", "confirm_add")
  .text("Отмена", "cancel_add");

export const removeConfirmationKeyboard = new InlineKeyboard()
  .text("Удалить", "confirm_remove")
  .text("Отмена", "cancel_remove");

export async function buildSettingsKeyboard(user_id: number): Promise<InlineKeyboard> {
  const user_settings = await getSettingsStateByUserId(user_id);
  if (!user_settings) {
    return new InlineKeyboard().text("Назад", "settingsBACK");
  }
  let onlineNotificationText = "Старт трансляции ";
  let offlineNotificationText = "Окончание трансляции ";
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

export const adminKeyboard = new InlineKeyboard()
  .text("Каналы", "admin_channels").text("Пользователи", "admin_users").row()
  .text("Администраторы", "admin_admins").row()
  .text("Ключи", "admin_keys").text("Добавить ключ", "admin_add").row()
  .text("Подписки", "admin_follows").text("Рассылка", "admin_broadcast").row()
  .text("🟣 EventSub Control", "admin_eventsub").text("🟢 Webhook Control", "admin_webhook").row()
  .text("Выйти", "admin_exit")

export const broadcastCancelKeyboard = new InlineKeyboard().text("Отмена", "admin_broadcast_cancel")

export const broadcastConfirmKeyboard = new InlineKeyboard()
  .text("Подтвердить", "admin_broadcast_confirm")
  .text("Отмена", "admin_broadcast_cancel")

export const adminBackKeyboard = new InlineKeyboard().text("Назад", "admin_back")

export const backHomeKeyboard = new InlineKeyboard().text("Назад", "settingsBACK")

export const infoBackKeyboard = new InlineKeyboard().text("Назад", "settingsBACK")

export const platformSelectKeyboard = new InlineKeyboard()
  .text("Kick", "platform_kick").text("Twitch", "platform_twitch").row()
  .text("Отмена", "platform_back")

export const removePlatformSelecteKeyboard = new InlineKeyboard()
  .text("Kick", "remove_platform_kick").text("Twitch", "remove_platform_twitch").row()
  .text("Отмена", "remove_platform_back")

export const eventsubControlKeyboard = new InlineKeyboard()
  .text("🔄 Перезапуск", "admin_eventsubreload_confirm")
  .text("❌ Отключить", "admin_eventsub_disconnect").row()
  .text("🧹 Очистить неиспольз.", "admin_eventsub_cleanup").row()
  .text("Назад", "admin_back")

export const eventsubResultKeyboard = new InlineKeyboard()
  .text("Назад", "admin_eventsub")

export const webhookControlKeyboard = new InlineKeyboard()
  .text("🔄 Перезапуск", "admin_webhookreload_confirm")
  .text("❌ Отключить", "admin_webhook_disconnect").row()
  .text("🧹 Очистить неиспольз.", "admin_webhook_cleanup").row()
  .text("Назад", "admin_back")

export const webhookResultKeyboard = new InlineKeyboard()
  .text("Назад", "admin_webhook")

export const adminAddConfirmKeyboard = new InlineKeyboard()
  .text("Подтвердить", "admin_add_confirm")
  .text("Отмена", "admin_back")

export const mySubscriptionsEmptyKeyboard = new InlineKeyboard()
  .text("Добавить", "mySubscriptionsAdd").row()
  .text("Назад", "settingsBACK")

export const mySubscriptionsKeyboard = new InlineKeyboard()
  .text("Добавить", "mySubscriptionsAdd")
  .text("Удалить", "mySubscriptionsRemove").row()
  .text("Назад", "settingsBACK")

export const mySubscriptionsAddBackKeyboard = new InlineKeyboard()
  .text("Назад", "mySubscriptionsCMD")
