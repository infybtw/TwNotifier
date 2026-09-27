<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { AdminUserDetail, AdminUserFollow, AdminUserNotification } from "~/composables/useAdmin";

const route = useRoute();
const { t } = useLocale();
const localizeError = useApiError();
const { userDetail, userFollows, userNotifications, updateUser, formatDate, loadSettings } = useAdmin();
useAdminGuard();

const userId = String(route.params.id ?? "");

const detail = ref<AdminUserDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

const follows = ref<AdminUserFollow[]>([]);
const followsCursor = ref<string | null>(null);
const followsLoading = ref(false);

const notifications = ref<AdminUserNotification[]>([]);
const notificationsCursor = ref<string | null>(null);
const notificationsLoading = ref(false);

const savingAdmin = ref(false);
const savingBlocked = ref(false);
const confirmingRevoke = ref(false);

const displayName = computed(() => {
  const user = detail.value;
  if (!user) return userId;
  return user.firstName || user.username || user.id;
});

const settingRows = computed(() => {
  const settings = detail.value?.settings;
  if (!settings) return [];
  return [
    { label: t("settings.stream_start"), on: settings.onlineNotification },
    { label: t("settings.stream_end"), on: settings.offlineNotification },
    { label: t("settings.title_change"), on: settings.titleChangeNotification },
    { label: t("settings.category_change"), on: settings.categoryChangeNotification },
    { label: t("settings.stream_metadata"), on: settings.streamMetadata },
    { label: t("settings.link_preview"), on: settings.linkPreview },
  ];
});

const deliveryLabel = computed(() => {
  const delivery = detail.value?.chatDelivery;
  if (delivery === "enabled") return t("settings.delivery_enabled");
  if (delivery === "blocked") return t("settings.delivery_blocked");
  return t("settings.delivery_unknown");
});

function eventLabel(event: string): string {
  return t(`admin.notif.${event}`);
}

function statusClass(status: string): string {
  if (status === "sent") return "bg-green-500/15 text-green-400";
  if (status === "blocked") return "bg-red-500/15 text-red-400";
  return "bg-amber-500/15 text-amber-400";
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    await loadSettings();
    detail.value = await userDetail(userId);
    const [followsPage, notificationsPage] = await Promise.all([
      userFollows(userId),
      userNotifications(userId),
    ]);
    follows.value = followsPage.items;
    followsCursor.value = followsPage.nextCursor;
    notifications.value = notificationsPage.items;
    notificationsCursor.value = notificationsPage.nextCursor;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loading.value = false;
  }
}

async function loadMoreFollows(): Promise<void> {
  if (!followsCursor.value || followsLoading.value) return;
  followsLoading.value = true;
  try {
    const page = await userFollows(userId, followsCursor.value);
    follows.value = [...follows.value, ...page.items];
    followsCursor.value = page.nextCursor;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    followsLoading.value = false;
  }
}

async function loadMoreNotifications(): Promise<void> {
  if (!notificationsCursor.value || notificationsLoading.value) return;
  notificationsLoading.value = true;
  try {
    const page = await userNotifications(userId, notificationsCursor.value);
    notifications.value = [...notifications.value, ...page.items];
    notificationsCursor.value = page.nextCursor;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    notificationsLoading.value = false;
  }
}

async function setAdmin(isAdmin: boolean): Promise<void> {
  if (savingAdmin.value) return;
  savingAdmin.value = true;
  error.value = null;
  try {
    const updated = await updateUser(userId, { isAdmin });
    if (detail.value) detail.value.isAdmin = updated.isAdmin;
    confirmingRevoke.value = false;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    savingAdmin.value = false;
  }
}

async function resetBlocked(): Promise<void> {
  if (savingBlocked.value) return;
  savingBlocked.value = true;
  error.value = null;
  try {
    const updated = await updateUser(userId, { isBotBlocked: false });
    if (detail.value) {
      detail.value.isBotBlocked = updated.isBotBlocked;
      if (!updated.isBotBlocked && detail.value.chatDelivery === "blocked") {
        detail.value.chatDelivery = "unknown";
      }
    }
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    savingBlocked.value = false;
  }
}

async function copyId(): Promise<void> {
  try {
    await navigator.clipboard.writeText(userId);
    notice.value = t("admin.user.copied");
  } catch {
    notice.value = null;
  }
}

onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-4">
    <NuxtLink to="/admin/users" class="text-sm font-medium tg-link">← {{ t("common.back") }}</NuxtLink>

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && !detail" :message="error" @retry="load" />
    <EmptyState v-else-if="!detail" :message="t('admin.user.not_found')" />

    <template v-else>
      <header class="flex flex-col gap-2 rounded-2xl px-4 py-4 tg-card">
        <div class="flex items-center justify-between gap-3">
          <span class="min-w-0 text-base font-semibold tg-text">
            {{ displayName }}
            <span v-if="detail.username" class="font-normal tg-hint">@{{ detail.username }}</span>
          </span>
          <span class="flex shrink-0 flex-col items-end gap-1">
            <span v-if="detail.isAdmin" class="rounded-full px-2 py-0.5 text-xs font-medium tg-secondary tg-link">
              {{ t("admin.users.admin_badge") }}
            </span>
            <span v-if="detail.isBotBlocked" class="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
              {{ t("admin.users.blocked_badge") }}
            </span>
          </span>
        </div>
        <dl class="flex flex-col gap-1 text-xs tg-hint">
          <div class="flex gap-1">
            <dt>ID:</dt>
            <dd class="tg-text">{{ detail.id }}</dd>
          </div>
          <div class="flex gap-1">
            <dt>{{ t("admin.user.registered") }}:</dt>
            <dd class="tg-text">{{ formatDate(detail.created) }}</dd>
          </div>
          <div class="flex gap-1">
            <dt>{{ t("admin.user.chat_delivery") }}:</dt>
            <dd class="tg-text">{{ deliveryLabel }}</dd>
          </div>
        </dl>
      </header>

      <div class="flex flex-col gap-2 rounded-2xl px-4 py-4 tg-card">
        <h2 class="text-sm font-semibold tg-text">{{ t("admin.user.actions") }}</h2>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="!detail.isAdmin"
            type="button"
            class="rounded-xl px-3 py-2 text-xs font-semibold tg-button"
            :disabled="savingAdmin"
            @click="setAdmin(true)"
          >
            {{ t("admin.user.make_admin") }}
          </button>
          <button
            v-else
            type="button"
            class="rounded-xl px-3 py-2 text-xs font-semibold tg-secondary tg-destructive"
            :disabled="savingAdmin"
            @click="confirmingRevoke = true"
          >
            {{ t("admin.user.revoke_admin") }}
          </button>
          <button
            v-if="detail.isBotBlocked"
            type="button"
            class="rounded-xl px-3 py-2 text-xs font-semibold tg-secondary tg-text"
            :disabled="savingBlocked"
            @click="resetBlocked"
          >
            {{ t("admin.user.unblock") }}
          </button>
          <button
            type="button"
            class="rounded-xl px-3 py-2 text-xs font-semibold tg-secondary tg-text"
            @click="copyId"
          >
            {{ t("admin.user.copy_id") }}
          </button>
        </div>

        <ConfirmDialog
          v-model:open="confirmingRevoke"
          destructive
          :busy="savingAdmin"
          :message="t('admin.user.revoke_admin_confirm')"
          @confirm="setAdmin(false)"
        />

        <p v-if="detail.isBotBlocked" class="text-xs tg-hint">{{ t("admin.user.unblock_hint") }}</p>
        <p v-if="notice" class="text-xs tg-link">{{ notice }}</p>
      </div>

      <div class="flex flex-col gap-2 rounded-2xl px-4 py-4 tg-card">
        <h2 class="text-sm font-semibold tg-text">{{ t("admin.user.settings") }}</h2>
        <ul class="flex flex-col gap-1.5 text-xs">
          <li v-for="row in settingRows" :key="row.label" class="flex items-center justify-between gap-2">
            <span class="tg-hint">{{ row.label }}</span>
            <span :class="row.on ? 'text-green-400' : 'tg-hint'">
              {{ row.on ? "✓" : "—" }}
            </span>
          </li>
          <li class="flex items-center justify-between gap-2">
            <span class="tg-hint">{{ t("settings.language") }}</span>
            <span class="tg-text">{{ detail.settings.language.toUpperCase() }}</span>
          </li>
        </ul>
      </div>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold tg-text">
          {{ t("admin.user.follows", { count: detail.follows }) }}
        </h2>
        <EmptyState v-if="follows.length === 0" :message="t('admin.empty')" />
        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="follow in follows"
            :key="`${follow.platform}:${follow.channelId}`"
            class="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card"
          >
            <span class="flex min-w-0 flex-col gap-1">
              <span class="truncate text-sm font-medium tg-text">{{ follow.channelName }}</span>
              <PlatformBadge :platform="follow.platform" />
            </span>
            <span class="shrink-0 text-xs tg-hint">{{ formatDate(follow.created) }}</span>
          </li>
        </ul>
        <button
          v-if="followsCursor"
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm font-medium tg-secondary tg-text"
          :disabled="followsLoading"
          @click="loadMoreFollows"
        >
          {{ t("follows.load_more") }}
        </button>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold tg-text">
          {{ t("admin.user.notifications") }} ({{ detail.notifications }})
        </h2>
        <EmptyState v-if="notifications.length === 0" :message="t('admin.empty')" />
        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="item in notifications"
            :key="item.id"
            class="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card"
          >
            <span class="flex min-w-0 flex-col gap-1">
              <span class="truncate text-sm font-medium tg-text">
                {{ eventLabel(item.event) }}
                <span v-if="item.channelName" class="font-normal tg-hint">· {{ item.channelName }}</span>
              </span>
              <span class="flex flex-wrap items-center gap-1.5">
                <PlatformBadge v-if="item.platform" :platform="item.platform" />
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="statusClass(item.status)"
                >
                  {{ t(`admin.notif.status_${item.status}`) }}
                </span>
              </span>
            </span>
            <span class="shrink-0 text-xs tg-hint">{{ formatDate(item.created) }}</span>
          </li>
        </ul>
        <button
          v-if="notificationsCursor"
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm font-medium tg-secondary tg-text"
          :disabled="notificationsLoading"
          @click="loadMoreNotifications"
        >
          {{ t("follows.load_more") }}
        </button>
      </section>

      <p v-if="error" class="text-sm tg-destructive">{{ error }}</p>
    </template>
  </section>
</template>
