<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { EventSubStatus, KickWebhookStatus } from "~/composables/useAdmin";

type InfraAction = "reload" | "disconnect" | "cleanup";
type InfraTarget = "eventsub" | "webhook";

const { t } = useLocale();
const localizeError = useApiError();
const admin = useAdmin();
useAdminGuard();

const eventSub = ref<EventSubStatus | null>(null);
const webhook = ref<KickWebhookStatus | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const busyAction = ref<string | null>(null);
const confirming = ref<{ target: InfraTarget; action: InfraAction } | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    [eventSub.value, webhook.value] = await Promise.all([
      admin.eventSubStatus(),
      admin.webhookStatus(),
    ]);
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loading.value = false;
  }
}

async function run(target: InfraTarget, action: InfraAction): Promise<void> {
  const key = `${target}:${action}`;
  if (busyAction.value) return;
  busyAction.value = key;
  error.value = null;
  notice.value = null;
  try {
    if (target === "eventsub") {
      if (action === "reload") {
        const result = await admin.eventSubReload();
        notice.value = t("admin.infra.result_reload", result);
      } else if (action === "disconnect") {
        const result = await admin.eventSubDisconnect();
        notice.value = t("admin.infra.result_disconnect", result);
      } else {
        const result = await admin.eventSubCleanup();
        notice.value = t("admin.infra.result_cleanup", result);
      }
    } else {
      if (action === "reload") {
        const result = await admin.webhookReload();
        notice.value = t("admin.infra.result_reload", result);
      } else if (action === "disconnect") {
        const result = await admin.webhookDisconnect();
        notice.value = t("admin.infra.result_disconnect", result);
      } else {
        const result = await admin.webhookCleanup();
        notice.value = t("admin.infra.result_cleanup", result);
      }
    }
    confirming.value = null;
    await load();
  } catch (err) {
    error.value = localizeError(err);
    confirming.value = null;
  } finally {
    busyAction.value = null;
  }
}

function ask(target: InfraTarget, action: InfraAction): void {
  confirming.value = { target, action };
}

onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.infra.title") }}</h1>

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && !eventSub" :message="error" @retry="load" />

    <template v-else>
      <div v-if="eventSub" class="rounded-2xl p-4 tg-card">
        <h2 class="text-sm font-semibold tg-text">{{ t("admin.infra.eventsub") }}</h2>
        <p class="mt-2 text-xs tg-hint">
          {{ t("admin.infra.total", { count: eventSub.total }) }}
          · {{ t("admin.infra.online", { count: eventSub.online }) }}
          · {{ t("admin.infra.offline", { count: eventSub.offline }) }}
          · {{ eventSub.transport }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="action in ['reload', 'disconnect', 'cleanup'] as InfraAction[]"
            :key="action"
            type="button"
            class="rounded-lg px-3 py-2 text-xs font-semibold"
            :class="action === 'disconnect' ? 'tg-secondary tg-destructive' : 'tg-secondary tg-text'"
            :disabled="busyAction !== null"
            @click="ask('eventsub', action)"
          >
            {{ busyAction === `eventsub:${action}` ? t("admin.infra.busy") : t(`admin.infra.${action}`) }}
          </button>
        </div>
      </div>

      <div v-if="webhook" class="rounded-2xl p-4 tg-card">
        <h2 class="text-sm font-semibold tg-text">{{ t("admin.infra.webhook") }}</h2>
        <p class="mt-2 text-xs tg-hint">
          {{ t("admin.infra.total", { count: webhook.total }) }}
          · {{ t("admin.infra.livestream", { count: webhook.livestream }) }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="action in ['reload', 'disconnect', 'cleanup'] as InfraAction[]"
            :key="action"
            type="button"
            class="rounded-lg px-3 py-2 text-xs font-semibold"
            :class="action === 'disconnect' ? 'tg-secondary tg-destructive' : 'tg-secondary tg-text'"
            :disabled="busyAction !== null"
            @click="ask('webhook', action)"
          >
            {{ busyAction === `webhook:${action}` ? t("admin.infra.busy") : t(`admin.infra.${action}`) }}
          </button>
        </div>
      </div>

      <div v-if="confirming" class="rounded-2xl p-4 text-sm tg-card tg-text">
        {{ t(`admin.infra.confirm_${confirming.action}`) }}
        <span class="mt-3 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold tg-button"
            :disabled="busyAction !== null"
            @click="run(confirming.target, confirming.action)"
          >
            {{ t("common.confirm") }}
          </button>
          <button
            type="button"
            class="rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text"
            @click="confirming = null"
          >
            {{ t("common.cancel") }}
          </button>
        </span>
      </div>

      <p v-if="notice" class="rounded-2xl px-4 py-3 text-sm tg-card tg-text">{{ notice }}</p>
      <p v-if="error" class="text-sm tg-destructive">{{ error }}</p>
    </template>
  </section>
</template>
