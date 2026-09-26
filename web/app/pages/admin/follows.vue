<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { AdminFollow } from "~/composables/useAdmin";

const { t } = useLocale();
const localizeError = useApiError();
const { follows, formatDate, loadSettings } = useAdmin();
useAdminGuard();

const items = ref<AdminFollow[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    await loadSettings();
    const response = await follows();
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
    const response = await follows(nextCursor.value);
    items.value = [...items.value, ...response.items];
    nextCursor.value = response.nextCursor;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loadingMore.value = false;
  }
}

function displayName(follow: AdminFollow): string {
  return follow.firstName || follow.username || follow.userId;
}

onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.follows.title") }}</h1>

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && items.length === 0" :message="error" @retry="load" />
    <EmptyState v-else-if="items.length === 0" :message="t('admin.empty')" />
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="follow in items"
        :key="`${follow.userId}:${follow.platform}:${follow.channelId}`"
        class="rounded-2xl px-4 py-3 tg-card"
      >
        <p class="text-sm tg-text">
          <span class="font-semibold">{{ displayName(follow) }}</span>
          <span v-if="follow.username" class="tg-hint"> @{{ follow.username }}</span>
          <span class="tg-hint"> → </span>
          <span class="font-semibold">{{ follow.channelName }}</span>
        </p>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PlatformBadge :platform="follow.platform" />
          <span class="text-xs tg-hint">{{ formatDate(follow.created) }}</span>
        </div>
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
