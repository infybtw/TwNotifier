<script setup lang="ts">
import type { AdminChannel } from "~/composables/useAdmin";

const { t } = useLocale();
const { channels } = useAdmin();
useAdminGuard();

const platform = useState<"twitch" | "kick" | "">("admin-channels-platform", () => "");
const { items, page, hasNext, loading, error, load, reset } = useCursorPagination<AdminChannel>(
  "admin-channels", (request) => channels({ ...request, platform: platform.value || undefined }),
);

watch(platform, () => void reset());
onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-4" data-paginated>
    <NuxtLink to="/admin" class="text-sm font-medium tg-link">← {{ t("admin.title") }}</NuxtLink>
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
    <ErrorState v-else-if="error && items.length === 0" :message="error" @retry="load()" />
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

    <PaginationControls
      v-if="items.length || page > 1 || loading"
      :page="page" :has-next="hasNext" :loading="loading"
      @change="load"
    />
    <p v-if="error && items.length > 0" class="text-sm tg-destructive">{{ error }}</p>
  </section>
</template>
