<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { AdminStats } from "~/composables/useAdmin";

const { t } = useLocale();
const localizeError = useApiError();
const { overview, utcOffset, loadSettings, saveTimezone, restart } = useAdmin();
useAdminGuard();

const stats = ref<AdminStats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const confirmingRestart = ref(false);
const restarting = ref(false);
const savingTz = ref(false);
const tzSaved = ref(false);

const sections = computed(() => [
  { to: "/admin/users", icon: "👥", label: t("admin.section.users") },
  { to: "/admin/channels", icon: "📺", label: t("admin.section.channels") },
  { to: "/admin/follows", icon: "🔗", label: t("admin.section.follows") },
  { to: "/admin/logs", icon: "📜", label: t("admin.section.logs") },
  { to: "/admin/keys", icon: "🔑", label: t("admin.section.keys") },
  { to: "/admin/broadcast", icon: "📣", label: t("admin.section.broadcast") },
  { to: "/admin/infra", icon: "🛰️", label: t("admin.section.infra") },
]);

const tzOptions = computed(() => {
  const options: number[] = [];
  for (let offset = -12; offset <= 14; offset++) options.push(offset);
  return options;
});

function tzLabel(offset: number): string {
  return `UTC${offset >= 0 ? `+${offset}` : offset}`;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    [stats.value] = await Promise.all([overview(), loadSettings().then(() => undefined)]);
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loading.value = false;
  }
}

async function onTzChange(event: Event): Promise<void> {
  const offset = Number((event.target as HTMLSelectElement).value);
  if (savingTz.value) return;
  savingTz.value = true;
  tzSaved.value = false;
  error.value = null;
  try {
    await saveTimezone(offset);
    utcOffset.value = offset;
    tzSaved.value = true;
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    savingTz.value = false;
  }
}

async function confirmRestart(): Promise<void> {
  if (restarting.value) return;
  restarting.value = true;
  try {
    await restart();
  } catch {
    // The process exits right after responding; a dropped connection is expected.
  }
}

onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("admin.title") }}</h1>

    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && !stats" :message="error" @retry="load" />

    <template v-else-if="stats">
      <div class="grid grid-cols-2 gap-2">
        <div class="rounded-2xl p-4 tg-card">
          <p class="text-2xl font-semibold tg-text">{{ stats.users }}</p>
          <p class="mt-1 text-xs tg-hint">{{ t("admin.stats.users") }}</p>
        </div>
        <div class="rounded-2xl p-4 tg-card">
          <p class="text-2xl font-semibold tg-text">{{ stats.follows }}</p>
          <p class="mt-1 text-xs tg-hint">{{ t("admin.stats.follows") }}</p>
        </div>
        <div class="rounded-2xl p-4 tg-card">
          <p class="text-2xl font-semibold tg-text">{{ stats.channels }}</p>
          <p class="mt-1 text-xs tg-hint">
            {{ t("admin.stats.channels") }} · Twitch {{ stats.twitchChannels }} · Kick {{ stats.kickChannels }}
          </p>
        </div>
        <div class="rounded-2xl p-4 tg-card">
          <p class="text-2xl font-semibold tg-text">{{ stats.admins }}</p>
          <p class="mt-1 text-xs tg-hint">{{ t("admin.stats.admins") }}</p>
        </div>
      </div>
      <p v-if="stats.blockedUsers > 0" class="text-xs tg-hint">
        {{ t("admin.stats.blocked", { count: stats.blockedUsers }) }}
      </p>

      <nav class="flex flex-col gap-2" :aria-label="t('admin.title')">
        <NuxtLink
          v-for="section in sections"
          :key="section.to"
          :to="section.to"
          class="flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 tg-card"
        >
          <span class="flex items-center gap-3">
            <span class="text-lg" aria-hidden="true">{{ section.icon }}</span>
            <span class="text-sm font-medium tg-text">{{ section.label }}</span>
          </span>
          <span class="text-lg tg-hint" aria-hidden="true">›</span>
        </NuxtLink>
      </nav>

      <div class="rounded-2xl p-4 tg-card">
        <label class="text-sm font-medium tg-text" for="admin-tz">{{ t("admin.tz") }}</label>
        <div class="mt-3 flex items-center gap-2">
          <select
            id="admin-tz"
            class="flex-1 rounded-xl px-3 py-2.5 text-sm tg-secondary tg-text"
            :value="utcOffset"
            :disabled="savingTz"
            @change="onTzChange"
          >
            <option v-for="offset in tzOptions" :key="offset" :value="offset">{{ tzLabel(offset) }}</option>
          </select>
          <span v-if="tzSaved" class="text-xs tg-hint">{{ t("common.saved") }}</span>
        </div>
      </div>

      <button
        type="button"
        class="rounded-xl px-4 py-3 text-sm font-semibold tg-secondary tg-destructive"
        @click="confirmingRestart = true"
      >
        {{ t("admin.restart") }}
      </button>
      <div v-if="confirmingRestart" class="rounded-2xl p-4 text-sm tg-card tg-text">
        {{ restarting ? t("admin.restarting") : t("admin.restart_confirm") }}
        <span v-if="!restarting" class="mt-3 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold tg-secondary tg-destructive"
            @click="confirmRestart"
          >
            {{ t("common.confirm") }}
          </button>
          <button
            type="button"
            class="rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text"
            @click="confirmingRestart = false"
          >
            {{ t("common.cancel") }}
          </button>
        </span>
      </div>

      <p v-if="error" class="text-sm tg-destructive">{{ error }}</p>
    </template>
  </section>
</template>
