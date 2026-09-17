import { InlineKeyboard } from "grammy";
import { getAdminSettings, getAllAdminKeys, getAllFollowsWithDetails, getSettingsStateByUserId, getUserByUserId } from "../database/db";
import { Channel, User, UserSettings } from "../database/schema";
import { ADMINER_URL, PGBACKWEB_URL } from "../config";
import { t, Locale } from "../i18n";

const ADMIN_PAGE_SIZE = 10;
const MY_SUBS_PAGE_SIZE = 8;

type AdminKeyWithIssuer = Awaited<ReturnType<typeof getAllAdminKeys>>[number];
type FollowWithDetails = Awaited<ReturnType<typeof getAllFollowsWithDetails>>[number];

export async function buildHomeKeyboard(user_id: number, locale: Locale = "ru"): Promise<InlineKeyboard> {
  const user = await getUserByUserId(user_id);
  const kb = new InlineKeyboard()
    .text(t("buttons.my_subscriptions", locale), "mySubscriptionsCMD")
    .row()
    .text(t("buttons.online_channels", locale), "mySubscriptionsOnline")
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
    .text(`⏰ Timezone: UTC${offsetStr}`, "admin_tz_change").row()
    .text(t("admin.settings.back", locale), "admin_back")
}

export function buildTimezoneKeyboard(locale: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("UTC+0", "admin_tz_0").row()
  for (let i = 1; i <= 12; i++) {
    kb.text(`UTC-${i}`, `admin_tz_-${i}`).text(`UTC+${i}`, `admin_tz_${i}`).row()
  }
  kb.text(`UTC-13`, `admin_tz_-13`).text(`UTC+13`, `admin_tz_13`).row()
  kb.text(`UTC-14`, `admin_tz_-14`).text(`UTC+14`, `admin_tz_14`).row()
  kb.text(t("admin.settings.back", locale), "admin_settings")
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

export function followOnlineKey(platform: string | null, channel_id: number, channel_name: string | null): string {
  if (platform === "twitch") return `twitch:${channel_id}`;
  return `kick:${(channel_name ?? "").toLowerCase()}`;
}

export function buildMySubscriptionsKeyboard(
  follows: { channel_id: number | null; channel_name: string | null; platform: string | null }[],
  page: number = 0,
  locale: Locale = "ru",
  onlineKeys: Set<string> = new Set(),
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const pageCount = Math.max(1, Math.ceil(follows.length / MY_SUBS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const pageFollows = follows.slice(safePage * MY_SUBS_PAGE_SIZE, (safePage + 1) * MY_SUBS_PAGE_SIZE);
  for (const follow of pageFollows) {
    const platformIcon = follow.platform === "twitch" ? "🟣" : "🟢";
    const name = follow.channel_name || `ID:${follow.channel_id}`;
    const live = onlineKeys.has(followOnlineKey(follow.platform, follow.channel_id!, follow.channel_name)) ? " 🔴" : "";
    kb.text(`${platformIcon} ${name}${live}`, `manage_${follow.platform}_${follow.channel_id}`).row();
  }
  if (pageCount > 1) {
    addPaginationRow(kb, safePage, pageCount, "mySubscriptionsPage", false);
  }
  kb.text(t("buttons.add", locale), "mySubscriptionsAdd").row();
  kb.text(t("buttons.back", locale), "settingsBACK");
  return kb;
}

export function buildFollowManagementKeyboard(platform: "kick" | "twitch", channel_id: number, locale: Locale = "ru", shareUrl?: string): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(t("follow.management.unfollow", locale), `manage_unfollow_${platform}_${channel_id}`)
    .text(t("follow.management.check_online", locale), `manage_online_${platform}_${channel_id}`).row();

  if (shareUrl) {
    keyboard.url(t("follow.management.share", locale), shareUrl).row();
  }

  return keyboard.text(t("follow.management.back", locale), "manage_back");
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

function addPaginationRow(kb: InlineKeyboard, page: number, pageCount: number, pageCallbackPrefix: string, wrap: boolean = true): InlineKeyboard {
  const prevPage = (page - 1 + pageCount) % pageCount;
  const nextPage = (page + 1) % pageCount;
  if (wrap || page > 0) {
    kb.text("←", `${pageCallbackPrefix}_${prevPage}`);
  }
  kb.text(`<${page + 1}/${pageCount}>`, "noop");
  if (wrap || page < pageCount - 1) {
    kb.text("→", `${pageCallbackPrefix}_${nextPage}`);
  }
  return kb.row();
}

export function buildAdminUsersKeyboard(users: (User & Pick<UserSettings, "is_bot_blocked">)[], page: number = 0, locale: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard();
  const pageCount = Math.max(1, Math.ceil(users.length / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const pageUsers = users.slice(safePage * ADMIN_PAGE_SIZE, (safePage + 1) * ADMIN_PAGE_SIZE);
  for (const user of pageUsers) {
    const username = user.username ? ` (@${user.username})` : "";
    const icon = user.is_bot_blocked === 1 ? "🚫" : "👤";
    kb.text(`${icon} ${user.first_name ?? user.user_id}${username}`, `admin_user_${user.user_id}`).row();
  }
  if (pageCount > 1) {
    addPaginationRow(kb, safePage, pageCount, "admin_users_page");
  }
  kb.text(t("buttons.back", locale), "admin_back");
  return kb;
}

export function buildAdminChannelsKeyboard(channels: Channel[], page: number = 0, locale: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard();
  const pageCount = Math.max(1, Math.ceil(channels.length / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const pageChannels = channels.slice(safePage * ADMIN_PAGE_SIZE, (safePage + 1) * ADMIN_PAGE_SIZE);
  for (const channel of pageChannels) {
    const icon = channel.platform === "twitch" ? "🟣" : "🟢";
    kb.text(`${icon} ${channel.channel_name}`, `admin_channel_${channel.channel_id}`).row();
  }
  if (pageCount > 1) {
    addPaginationRow(kb, safePage, pageCount, "admin_channels_page");
  }
  kb.text(t("buttons.back", locale), "admin_back");
  return kb;
}

export function buildAdminUserDetailKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "admin_users");
}

export function buildAdminChannelDetailKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "admin_channels");
}

export function buildAdminAdminsKeyboard(admins: User[], page: number = 0, locale: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard();
  const pageCount = Math.max(1, Math.ceil(admins.length / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const pageAdmins = admins.slice(safePage * ADMIN_PAGE_SIZE, (safePage + 1) * ADMIN_PAGE_SIZE);
  for (const admin of pageAdmins) {
    const username = admin.username ? ` (@${admin.username})` : "";
    kb.text(`⚡ ${admin.first_name ?? admin.user_id}${username}`, `admin_admin_${admin.user_id}`).row();
  }
  if (pageCount > 1) {
    addPaginationRow(kb, safePage, pageCount, "admin_admins_page");
  }
  kb.text(t("buttons.back", locale), "admin_back");
  return kb;
}

export function buildAdminAdminDetailKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "admin_admins");
}

export function buildAdminKeysKeyboard(keys: AdminKeyWithIssuer[], page: number = 0, locale: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard();
  const pageCount = Math.max(1, Math.ceil(keys.length / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const pageKeys = keys.slice(safePage * ADMIN_PAGE_SIZE, (safePage + 1) * ADMIN_PAGE_SIZE);
  for (const key of pageKeys) {
    const icon = key.used ? "✅" : "🔑";
    kb.text(`${icon} ${key.key.slice(0, 8)}...`, `admin_key_${key.id}`).row();
  }
  if (pageCount > 1) {
    addPaginationRow(kb, safePage, pageCount, "admin_keys_page");
  }
  kb.text(t("buttons.back", locale), "admin_back");
  return kb;
}

export function buildAdminKeyDetailKeyboard(keyId: number, key: string, used: boolean, locale: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (!used) {
    kb.text(t("admin.btn.revoke_key", locale).replace("{key}", key.slice(0, 8) + "..."), `admin_key_revoke_confirm_${keyId}`).row();
  }
  kb.text(t("buttons.back", locale), "admin_keys");
  return kb;
}

export function buildAdminKeysBackKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "admin_keys");
}

export function buildAdminFollowsKeyboard(follows: FollowWithDetails[], page: number = 0, locale: Locale = "ru"): InlineKeyboard {
  const kb = new InlineKeyboard();
  const pageCount = Math.max(1, Math.ceil(follows.length / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const pageFollows = follows.slice(safePage * ADMIN_PAGE_SIZE, (safePage + 1) * ADMIN_PAGE_SIZE);
  for (const follow of pageFollows) {
    const icon = follow.platform === "twitch" ? "🟣" : "🟢";
    const user = follow.username ? `@${follow.username}` : (follow.first_name ?? follow.user_id);
    kb.text(`${icon} ${follow.channel_name} — ${user}`, `admin_follow_${follow.platform}_${follow.user_id}_${follow.channel_id}`).row();
  }
  if (pageCount > 1) {
    addPaginationRow(kb, safePage, pageCount, "admin_follows_page");
  }
  kb.text(t("buttons.back", locale), "admin_back");
  return kb;
}

export function buildAdminFollowDetailKeyboard(locale: Locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text(t("buttons.back", locale), "admin_follows");
}
