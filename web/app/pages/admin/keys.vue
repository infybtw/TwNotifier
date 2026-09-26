<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { AdminKeyItem } from "~/composables/useAdmin";

const { t } = useLocale();
const localizeError = useApiError();
const { keys, createKey, revokeKey, formatDate, loadSettings } = useAdmin();
useAdminGuard();

const items = ref<AdminKeyItem[]>([]);
const loading = ref(true);
const busy = ref(false);
const revoking = ref<AdminKeyItem | null>(null);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    await loadSettings();
    const response = await keys();
    items.value = response.items;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loading.value = false;
  }
}

async function create(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    await createKey();
    notice.value = t("admin.keys.created");
    await load();
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    busy.value = false;
  }
}

async function confirmRevoke(): Promise<void> {
  const key = revoking.value;
  if (!key || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    await revokeKey(key.id);
    revoking.value = null;
    await load();
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    busy.value = false;
  }
}

async function copy(key: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(key);
    notice.value = t("admin.keys.copied");
  } catch {
    notice.value = null;
  }
}

function issuerName(key: AdminKeyItem): string {
  return key.issuedByName || key.issuedByUsername || key.issuedBy;
}

onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.keys.title") }}</h1>
    <p class="text-xs tg-hint">{{ t("admin.keys.hint") }}</p>

    <button
      type="button"
      class="rounded-xl px-4 py-3 text-sm font-semibold tg-button"
      :disabled="busy"
      @click="create"
    >
      {{ t("admin.keys.create") }}
    </button>

    <p v-if="notice" class="rounded-2xl px-4 py-3 text-sm tg-card tg-text">{{ notice }}</p>

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && items.length === 0" :message="error" @retry="load" />
    <EmptyState v-else-if="items.length === 0" :message="t('admin.empty')" />
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="key in items"
        :key="key.id"
        class="flex flex-col gap-2 rounded-2xl px-4 py-3 tg-card"
      >
        <div class="flex items-center justify-between gap-2">
          <button
            type="button"
            class="min-w-0 truncate text-left font-mono text-sm font-medium tg-link"
            :aria-label="t('admin.keys.copy')"
            @click="copy(key.key)"
          >
            {{ key.key.slice(0, 8) }}…
          </button>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="key.used ? 'tg-secondary tg-hint' : 'bg-green-500/15 text-green-400'"
          >
            {{ key.used ? t("admin.keys.used") : t("admin.keys.unused") }}
          </span>
        </div>
        <p class="text-xs tg-hint">
          {{ t("admin.keys.issued_by", { name: issuerName(key) }) }} · {{ formatDate(key.issueDate) }}
          <template v-if="key.used && key.usedDate">
            · {{ t("admin.keys.used_at") }} {{ formatDate(key.usedDate) }}
          </template>
        </p>
        <button
          v-if="!key.used"
          type="button"
          class="self-start rounded-lg px-3 py-1.5 text-xs font-semibold tg-secondary tg-destructive"
          @click="revoking = key"
        >
          {{ t("admin.keys.revoke") }}
        </button>
      </li>
    </ul>

    <div v-if="revoking" class="rounded-2xl p-4 text-sm tg-card tg-text">
      {{ t("admin.keys.revoke_confirm") }}
      <span class="mt-3 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold tg-secondary tg-destructive"
          :disabled="busy"
          @click="confirmRevoke"
        >
          {{ t("common.confirm") }}
        </button>
        <button
          type="button"
          class="rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text"
          @click="revoking = null"
        >
          {{ t("common.cancel") }}
        </button>
      </span>
    </div>

    <p v-if="error && items.length > 0" class="text-sm tg-destructive">{{ error }}</p>
  </section>
</template>
