<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { EventSubReconnect } from "~/composables/useAdmin";

const { t } = useLocale();
const localizeError = useApiError();
const admin = useAdmin();
const items = ref<EventSubReconnect[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  error.value = null;
  try {
    const [response] = await Promise.all([admin.eventSubReconnects(), admin.loadSettings()]);
    items.value = response.items;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loading.value = false;
  }
}

function formatTime(iso: string): string {
  return `${admin.formatDate(iso)}:${String(new Date(iso).getUTCSeconds()).padStart(2, "0")}`;
}

function duration(item: EventSubReconnect): string {
  return ((Date.parse(item.finishedAt) - Date.parse(item.startedAt)) / 1_000).toFixed(1);
}

function closeDescription(code: number): string {
  const key = `admin.infra.reconnects.close_${code}`;
  const translated = t(key);
  return translated === key ? t("admin.infra.reconnects.close_unknown") : translated;
}

onMounted(() => void load());
</script>

<template>
  <div class="rounded-2xl p-4 tg-card">
    <header class="flex items-baseline justify-between gap-2">
      <h2 class="text-sm font-semibold tg-text">{{ t("admin.infra.reconnects.title") }}</h2>
      <button type="button" class="text-xs font-medium tg-link" :disabled="loading" @click="load">
        {{ t("common.refresh") }}
      </button>
    </header>
    <p class="mt-2 text-xs tg-hint">{{ t("admin.infra.reconnects.hint") }}</p>

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <p v-else-if="items.length === 0" class="mt-3 text-xs tg-hint">
      {{ t("admin.infra.reconnects.empty") }}
    </p>
    <ul v-else class="mt-3 flex flex-col gap-2">
      <li v-for="item in items" :key="item.id" class="min-w-0 rounded-xl p-3 tg-secondary">
        <div class="flex flex-wrap items-baseline justify-between gap-1">
          <time :datetime="item.startedAt" class="text-xs tg-hint">{{ formatTime(item.startedAt) }}</time>
          <span class="text-xs font-semibold" :class="item.status === 'failed' ? 'tg-destructive' : 'tg-text'">
            {{ t(`admin.infra.reconnects.${item.status}`) }}
          </span>
        </div>
        <p class="mt-1 text-sm tg-text">{{ t(`admin.infra.reconnects.reason_${item.reason}`) }}</p>
        <p class="mt-1 text-xs tg-hint">
          {{ t("admin.infra.reconnects.attempt", { count: item.attempt }) }}
          · {{ t("admin.infra.reconnects.duration", { seconds: duration(item) }) }}
          · {{ t("admin.infra.reconnects.delay", { seconds: (item.delayMs / 1_000).toFixed(1) }) }}
        </p>
        <p v-if="item.closeCode !== null" class="mt-1 break-words text-xs tg-hint">
          {{ t("admin.infra.reconnects.close_code", { code: item.closeCode }) }}: {{ closeDescription(item.closeCode) }}
        </p>
        <p v-if="item.closeReason" class="mt-1 break-words text-xs tg-hint">{{ item.closeReason }}</p>
        <p v-if="item.error" class="mt-1 break-words text-xs tg-destructive">{{ item.error }}</p>
        <details v-if="item.details || item.previousSessionId || item.sessionId" class="mt-2 text-xs tg-hint">
          <summary class="cursor-pointer">{{ t("admin.infra.reconnects.details") }}</summary>
          <p v-if="item.details" class="mt-1 break-words">{{ item.details }}</p>
          <p v-if="item.previousSessionId" class="mt-1 break-all">
            {{ t("admin.infra.reconnects.previous_session") }}: {{ item.previousSessionId }}
          </p>
          <p v-if="item.sessionId" class="mt-1 break-all">
            {{ t("admin.infra.reconnects.session") }}: {{ item.sessionId }}
          </p>
        </details>
      </li>
    </ul>
  </div>
</template>
