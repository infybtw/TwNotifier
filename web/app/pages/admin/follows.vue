<script setup lang="ts">
import type { AdminFollow } from "~/composables/useAdmin";

const { t } = useLocale();
const { follows, formatDate, loadSettings } = useAdmin();
useAdminGuard();

const { items, page, pageSize, hasNext, loading, error, load, setPageSize } = useCursorPagination<AdminFollow>(
  "admin-follows", async ({ cursor, limit }) => {
    await loadSettings();
    return follows(cursor, limit);
  },
);

function displayName(follow: AdminFollow): string {
  return follow.firstName || follow.username || follow.userId;
}

onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-4" data-paginated>
    <NuxtLink to="/admin" class="text-sm font-medium tg-link">← {{ t("admin.title") }}</NuxtLink>
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.follows.title") }}</h1>

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && items.length === 0" :message="error" @retry="load()" />
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

    <PaginationControls
      v-if="items.length || page > 1 || loading"
      :page="page" :page-size="pageSize" :has-next="hasNext" :loading="loading"
      @change="load" @page-size="setPageSize"
    />
    <p v-if="error && items.length > 0" class="text-sm tg-destructive">{{ error }}</p>
  </section>
</template>
