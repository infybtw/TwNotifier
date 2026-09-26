<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { AdminUser } from "~/composables/useAdmin";

const { t } = useLocale();
const localizeError = useApiError();
const { users, formatDate, loadSettings } = useAdmin();
useAdminGuard();

const items = ref<AdminUser[]>([]);
const nextCursor = ref<string | null>(null);
const search = ref("");
const loading = ref(true);
const loadingMore = ref(false);
const error = ref<string | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    await loadSettings();
    const response = await users({ search: search.value || undefined });
    items.value = response.items;
    nextCursor.value = response.nextCursor;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (!nextCursor.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const response = await users({ search: search.value || undefined, cursor: nextCursor.value });
    items.value = [...items.value, ...response.items];
    nextCursor.value = response.nextCursor;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loadingMore.value = false;
  }
}

function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void load(), 300);
}

function displayName(user: AdminUser): string {
  return user.firstName || user.username || user.id;
}

onMounted(() => void load());
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.users.title") }}</h1>

    <input
      v-model="search"
      type="search"
      class="w-full rounded-xl px-4 py-2.5 text-sm tg-card tg-text placeholder:text-[var(--tg-hint)]"
      :placeholder="t('admin.users.search')"
      @input="onSearchInput"
    >

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && items.length === 0" :message="error" @retry="load" />
    <EmptyState v-else-if="items.length === 0" :message="t('admin.empty')" />
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="user in items"
        :key="user.id"
        class="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card"
      >
        <span class="flex min-w-0 flex-col gap-1">
          <span class="truncate text-sm font-semibold tg-text">
            {{ displayName(user) }}
            <span v-if="user.username" class="font-normal tg-hint">@{{ user.username }}</span>
          </span>
          <span class="flex flex-wrap items-center gap-1.5 text-xs tg-hint">
            <span>ID {{ user.id }}</span>
            <span>· {{ t("admin.users.follows", { count: user.follows }) }}</span>
            <span>· {{ formatDate(user.created) }}</span>
          </span>
        </span>
        <span class="flex shrink-0 flex-col items-end gap-1">
          <span v-if="user.isAdmin" class="rounded-full px-2 py-0.5 text-xs font-medium tg-secondary tg-link">
            {{ t("admin.users.admin_badge") }}
          </span>
          <span v-if="user.isBotBlocked" class="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
            {{ t("admin.users.blocked_badge") }}
          </span>
        </span>
      </li>
    </ul>

    <button
      v-if="nextCursor"
      type="button"
      class="rounded-xl px-4 py-2.5 text-sm font-medium tg-secondary tg-text"
      :disabled="loadingMore"
      @click="loadMore"
    >
      {{ t("follows.load_more") }}
    </button>
    <p v-if="error && items.length > 0" class="text-sm tg-destructive">{{ error }}</p>
  </section>
</template>
