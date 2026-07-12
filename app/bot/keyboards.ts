import { InlineKeyboard } from "grammy";
import { getSettingsStateByUserId, getUserByUserId } from "../database/db";
import { ADMINER_URL, PGBACKWEB_URL } from "../config";
import { t, Locale } from "../i18n";

export async function buildHomeKeyboard(user_id: number, locale: Locale = "ru"): Promise<InlineKeyboard> {
  const user = await getUserByUserId(user_id);
  const kb = new InlineKeyboard()
    .text(t("buttons.my_subscriptions", locale), "mySubscriptionsCMD")
    .row()
    .text(t("buttons.settings", locale), "settingsCMD")
    .text(t("buttons.info", locale), "infoCMD")
    .row()
    .text(t("buttons.language", locale), "langCMD");
  if (user?.is_admin) {
    kb.row().text(t("buttons.admin", locale), "adminCMD");
  }
  return kb;
}

export function buildAddConfirmationKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.confirm", locale), "confirm_add")
    .text(t("buttons.cancel", locale), "cancel_add");
}

export function buildRemoveConfirmationKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.delete", locale), "confirm_remove")
    .text(t("buttons.cancel", locale), "cancel_remove");
}

export async function buildSettingsKeyboard(user_id: number, locale: Locale = "ru"): Promise<InlineKeyboard> {
  const user_settings = await getSettingsStateByUserId(user_id);
  if (!user_settings) {
    return new InlineKeyboard().text(t("buttons.back", locale), "settingsBACK");
  }
  let onlineNotificationText = t("settings.stream_start", locale);
  let offlineNotificationText = t("settings.stream_end", locale);
  let linkPreviewText = t("settings.link_preview", locale);
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
  if (user_settings?.link_preview === 1) {
    linkPreviewText += "✅";
  } else {
    linkPreviewText += "🚫";
  }

  return new InlineKeyboard()
    .text(onlineNotificationText, "toogleOnlineNotificationCMD")
    .row()
    .text(offlineNotificationText, "toggleOfflineNotificationCMD")
    .row()
    .text(linkPreviewText, "toggleLinkPreviewCMD")
    .row()
    .text(t("buttons.back", locale), "settingsBACK");
}

export function buildAdminKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("📺 Каналы", "admin_channels").text("👥 Пользователи", "admin_users").row()
    .text("🛡 Администраторы", "admin_admins").row()
    .text("🔑 Ключи", "admin_keys").text("➕ Добавить ключ", "admin_add").row()
    .text("📋 Подписки", "admin_follows").text("📨 Рассылка", "admin_broadcast").row()
    .text("🟣 EventSub Control", "admin_eventsub").text("🟢 Webhook Control", "admin_webhook").row()
    .text("📝 Логи", "admin_logs").row()
  if (ADMINER_URL && ADMINER_URL !== "undefined") kb.url("🗃 Adminer", ADMINER_URL)
  if (PGBACKWEB_URL && PGBACKWEB_URL !== "undefined") kb.url("💾 pgbackweb", PGBACKWEB_URL)
  if (ADMINER_URL && ADMINER_URL !== "undefined" && PGBACKWEB_URL && PGBACKWEB_URL !== "undefined") kb.row()
  kb.text("🔄 Restart", "admin_restart").row()
  kb.text("🚪 Выйти", "admin_exit")
  return kb
}

export function buildBroadcastCancelKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.cancel", locale), "admin_broadcast_cancel");
}

export function buildBroadcastConfirmKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.confirm", locale), "admin_broadcast_confirm")
    .text(t("buttons.cancel", locale), "admin_broadcast_cancel");
}

export function buildAdminBackKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "admin_back");
}

export function buildBackHomeKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "settingsBACK");
}

export function buildInfoBackKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "settingsBACK");
}

export function buildPlatformSelectKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text("Kick", "platform_kick").text("Twitch", "platform_twitch").row()
    .text(t("buttons.cancel", locale), "platform_back");
}

export function buildRemovePlatformSelectKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text("Kick", "remove_platform_kick").text("Twitch", "remove_platform_twitch").row()
    .text(t("buttons.cancel", locale), "remove_platform_back");
}

export function buildEventsubControlKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Перезапуск", "admin_eventsubreload_confirm")
    .text("❌ Отключить", "admin_eventsub_disconnect").row()
    .text("🧹 Очистить неиспольз.", "admin_eventsub_cleanup").row()
    .text(t("buttons.back", locale), "admin_back");
}

export function buildEventsubResultKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "admin_eventsub");
}

export function buildWebhookControlKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Перезапуск", "admin_webhookreload_confirm")
    .text("❌ Отключить", "admin_webhook_disconnect").row()
    .text("🧹 Очистить неиспольз.", "admin_webhook_cleanup").row()
    .text(t("buttons.back", locale), "admin_back");
}

export function buildWebhookResultKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "admin_webhook");
}

export function buildAdminAddConfirmKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.confirm", locale), "admin_add_confirm")
    .text(t("buttons.cancel", locale), "admin_back");
}

export function buildMySubscriptionsEmptyKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.add", locale), "mySubscriptionsAdd").row()
    .text(t("buttons.back", locale), "settingsBACK");
}

export function buildMySubscriptionsKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.add", locale), "mySubscriptionsAdd")
    .text(t("buttons.remove", locale), "mySubscriptionsRemove").row()
    .text(t("buttons.online_channels", locale), "mySubscriptionsOnline").row()
    .text(t("buttons.back", locale), "settingsBACK");
}

export function buildMySubscriptionsAddBackKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "mySubscriptionsCMD");
}

export function buildRestartConfirmKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.confirm", locale), "admin_restart_confirm")
    .text(t("buttons.cancel", locale), "admin_back");
}

export function buildLanguageKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.ru", locale), "lang_ru")
    .text(t("buttons.en", locale), "lang_en").row()
    .text(t("buttons.back", locale), "settingsBACK");
}
