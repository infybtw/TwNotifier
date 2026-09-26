<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { AdminLog } from "~/composables/useAdmin";

const { t } = useLocale();
const localizeError = useApiError();
const { logs, formatDate, loadSettings } = useAdmin();
useAdminGuard();

const items = ref<AdminLog[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    await loadSettings();
    const response = await logs();
    items.value = response.items;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex items-baseline justify-between gap-2">
      <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.logs.title") }}</h1>
      <button type="button" class="text-xs font-medium tg-link" @click="load">
        {{ t("common.refresh") }}
      </button>
    </header>

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <EmptyState v-else-if="items.length === 0" :message="t('admin.empty')" />
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="log in items"
        :key="log.id"
        class="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card"
      >
        <span class="flex min-w-0 flex-col gap-1">
          <span class="truncate text-sm font-medium tg-text">
            <span aria-hidden="true">{{ log.event === "online" ? "🟢" : "⚪" }}</span>
            {{ log.channelName ?? log.channelId }}
          </span>
          <span class="flex flex-wrap items-center gap-1.5">
            <PlatformBadge :platform="log.platform" />
            <span class="text-xs tg-hint">
              {{ t(`admin.logs.${log.event === "online" ? "online" : "offline"}`) }}
              · {{ t("admin.logs.followers", { count: log.followers }) }}
            </span>
          </span>
        </span>
        <span class="shrink-0 text-xs tg-hint">{{ formatDate(log.created) }}</span>
      </li>
    </ul>
  </section>
</template>
