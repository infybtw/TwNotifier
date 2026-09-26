<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { AdminChannel } from "~/composables/useAdmin";

const { t } = useLocale();
const localizeError = useApiError();
const { channels } = useAdmin();
useAdminGuard();

const items = ref<AdminChannel[]>([]);
const nextCursor = ref<string | null>(null);
const platform = ref<"twitch" | "kick" | "">("");
const loading = ref(true);
const loadingMore = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const response = await channels({ platform: platform.value || undefined });
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
    const response = await channels({ platform: platform.value || undefined, cursor: nextCursor.value });
    items.value = [...items.value, ...response.items];
    nextCursor.value = response.nextCursor;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loadingMore.value = false;
  }
}

watch(platform, () => void load());
onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.channels.title") }}</h1>

    <div class="flex gap-2" role="group">
      <button
        v-for="option in [
          { value: '', label: t('follows.filter_all') },
          { value: 'twitch', label: t('follows.filter_twitch') },
          { value: 'kick', label: t('follows.filter_kick') },
        ]"
        :key="option.value"
        type="button"
        class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
        :class="platform === option.value ? 'tg-button' : 'tg-secondary tg-text'"
        :aria-pressed="platform === option.value"
        @click="platform = option.value as '' | 'twitch' | 'kick'"
      >
        {{ option.label }}
      </button>
    </div>

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && items.length === 0" :message="error" @retry="load" />
    <EmptyState v-else-if="items.length === 0" :message="t('admin.empty')" />
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="channel in items"
        :key="`${channel.platform}:${channel.channelId}`"
        class="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card"
      >
        <span class="flex min-w-0 flex-col gap-1">
          <span class="truncate text-sm font-semibold tg-text">{{ channel.name }}</span>
          <PlatformBadge :platform="channel.platform" />
        </span>
        <span class="shrink-0 text-xs tg-hint">
          {{ t("admin.channels.followers", { count: channel.followers }) }}
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
