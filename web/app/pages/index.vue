<script setup lang="ts">
import type { Follow } from "~/composables/useFollows";

const { t } = useLocale();
const { getPage } = useFollows();

const platform = useState<"twitch" | "kick" | "">("follows-platform", () => "");
const search = useState("follows-search", () => "");
const { items, page, hasNext, loading, error, load, reset, invalidate } = useCursorPagination<Follow>(
  "follows", (request) => getPage({ ...request, platform: platform.value || undefined, search: search.value || undefined }),
);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const onlineCount = computed(() => items.value.filter((item: Follow) => item.online === "online").length);

async function reload(): Promise<void> {
  await load();
}

function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer);
  invalidate();
  loading.value = true;
  searchTimer = setTimeout(() => void reset(), 300);
}

watch(platform, () => {
  if (searchTimer) clearTimeout(searchTimer);
  void reset();
});
onMounted(() => void reload());
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <section class="flex flex-col gap-4" data-paginated>
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("follows.title") }}</h1>
      <p class="text-xs tg-hint">
        {{ t("follows.page_summary", { total: items.length, online: onlineCount }) }}
      </p>
    </header>

    <input
      v-model="search"
      type="search"
      class="w-full rounded-xl px-4 py-2.5 text-sm tg-card tg-text placeholder:text-[var(--tg-hint)]"
      :placeholder="t('follows.search')"
      :aria-label="t('follows.search')"
      maxlength="64"
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
    <ErrorState v-else-if="error && items.length === 0" :message="error" @retry="reload" />
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

    <PaginationControls
      v-if="items.length || page > 1 || loading"
      :page="page" :has-next="hasNext" :loading="loading"
      @change="load"
    />
    <ErrorState v-if="error && items.length > 0" :message="error" @retry="reload" />
  </section>
</template>
