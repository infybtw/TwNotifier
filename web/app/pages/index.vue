<script setup lang="ts">
import type { Follow } from "~/composables/useFollows";

const { t } = useLocale();
const { items, loading, loadingMore, error, nextCursor, load, loadMore } = useFollows();

const platform = ref<"twitch" | "kick" | "">("");
const search = ref("");
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const onlineCount = computed(() => items.value.filter((item: Follow) => item.online === "online").length);

async function reload(): Promise<void> {
  await load({ platform: platform.value || undefined, search: search.value || undefined });
}

function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void reload(), 300);
}

watch(platform, () => void reload());
onMounted(() => void reload());
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex items-baseline justify-between gap-2">
      <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("follows.title") }}</h1>
      <p class="text-xs tg-hint">
        {{ t("follows.total", { total: items.length }) }} · {{ t("follows.online_count", { online: onlineCount }) }}
      </p>
    </header>

    <input
      v-model="search"
      type="search"
      class="w-full rounded-xl px-4 py-2.5 text-sm tg-card tg-text placeholder:text-[var(--tg-hint)]"
      :placeholder="t('follows.search')"
      @input="onSearchInput"
    >

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
    <ErrorState v-else-if="error" :message="error" @retry="reload" />
    <EmptyState
      v-else-if="items.length === 0"
      :message="t('follows.empty')"
      :action-label="t('follows.empty_action')"
      action-to="/add"
    />
    <ul v-else class="flex flex-col gap-2">
      <li v-for="follow in items" :key="`${follow.platform}:${follow.channelId}`">
        <FollowCard :follow="follow" />
      </li>
    </ul>

    <button
      v-if="nextCursor"
      type="button"
      class="rounded-xl px-4 py-2.5 text-sm font-medium tg-secondary tg-text"
      :disabled="loadingMore"
      @click="loadMore({ platform: platform || undefined, search: search || undefined })"
    >
      {{ t("follows.load_more") }}
    </button>
  </section>
</template>
