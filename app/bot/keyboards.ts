import { InlineKeyboard } from "grammy";
import { getAdminSettings, getSettingsStateByUserId, getUserByUserId } from "../database/db";
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

export function buildAdminKeyboard(locale: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text(t("admin.btn.channels", locale), "admin_channels").text(t("admin.btn.users", locale), "admin_users").row()
    .text(t("admin.btn.admins", locale), "admin_admins").row()
    .text(t("admin.btn.keys", locale), "admin_keys").text(t("admin.btn.add_key", locale), "admin_add").row()
    .text(t("admin.btn.follows", locale), "admin_follows").text(t("admin.btn.broadcast", locale), "admin_broadcast").row()
    .text(t("admin.btn.eventsub", locale), "admin_eventsub").text(t("admin.btn.webhook", locale), "admin_webhook").row()
    .text(t("admin.btn.logs", locale), "admin_logs").row()
  if (ADMINER_URL && ADMINER_URL !== "undefined") kb.url("🗃 Adminer", ADMINER_URL)
  if (PGBACKWEB_URL && PGBACKWEB_URL !== "undefined") kb.url("💾 pgbackweb", PGBACKWEB_URL)
  if (ADMINER_URL && ADMINER_URL !== "undefined" && PGBACKWEB_URL && PGBACKWEB_URL !== "undefined") kb.row()
  kb.text(t("admin.btn.settings", locale), "admin_settings").row()
  kb.text(t("admin.btn.restart", locale), "admin_restart").row()
  kb.text(t("admin.btn.exit", locale), "admin_exit")
  return kb
}

export async function buildAdminSettingsKeyboard(user_id: number, locale: Locale = "ru"): Promise<InlineKeyboard> {
  const settings = await getAdminSettings(user_id)
  const offset = settings?.utc_offset ?? 0
  const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`

  return new InlineKeyboard()
    .text(`${t("admin.settings.timezone", locale).replace("{offset}", `UTC${offsetStr}`)}`, "noop").row()
    .text(t("admin.settings.timezone_change", locale), "admin_tz_change").row()
    .text(t("admin.settings.back", locale), "admin_back")
}

export function buildTimezoneKeyboard(locale: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (let offset = -12; offset <= 14; offset++) {
    const label = offset >= 0 ? `UTC+${offset}` : `UTC${offset}`
    kb.text(label, `admin_tz_${offset}`)
    if ((offset + 12) % 7 === 6) kb.row()
  }
  kb.row().text(t("admin.settings.back", locale), "admin_settings")
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
    .text(t("admin.btn.eventsub_restart", locale), "admin_eventsubreload_confirm")
    .text(t("admin.btn.eventsub_disconnect", locale), "admin_eventsub_disconnect").row()
    .text(t("admin.btn.eventsub_cleanup", locale), "admin_eventsub_cleanup").row()
    .text(t("buttons.back", locale), "admin_back");
}

export function buildEventsubResultKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "admin_eventsub");
}

export function buildWebhookControlKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("admin.btn.webhook_restart", locale), "admin_webhookreload_confirm")
    .text(t("admin.btn.webhook_disconnect", locale), "admin_webhook_disconnect").row()
    .text(t("admin.btn.webhook_cleanup", locale), "admin_webhook_cleanup").row()
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
