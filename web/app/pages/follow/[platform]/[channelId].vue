<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { FollowDetails } from "~/composables/useFollows";

const { t, locale } = useLocale();
const route = useRoute();
const router = useRouter();
const { getDetails, removeFollow } = useFollows();
const { openExternal, openTelegramLink } = useTelegram();
const localizeError = useApiError();

const details = ref<FollowDetails | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const confirming = ref(false);
const busy = ref(false);

const platform = computed(() => String(route.params.platform));
const channelId = computed(() => String(route.params.channelId));

const capabilities = computed(() => details.value?.capabilities ?? { titleChange: false, categoryChange: false });
const live = computed(() => details.value?.live);

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale.value === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    details.value = await getDetails(platform.value, channelId.value);
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    loading.value = false;
  }
}

async function confirmRemove(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    await removeFollow(platform.value, channelId.value);
    await router.push("/");
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    busy.value = false;
    confirming.value = false;
  }
}

function share(): void {
  if (!details.value) return;
  if (details.value.shareUrl) {
    openTelegramLink(details.value.shareUrl);
  } else {
    openExternal(details.value.url);
  }
}

onMounted(() => void load());
</script>

<template>
  <section class="flex flex-col gap-3">
    <LoadingState v-if="loading" />
    <ErrorState v-else-if="error && !details" :message="error" @retry="load" />

    <template v-else-if="details">
      <header class="rounded-xl p-4 tg-card">
        <h1 class="text-lg font-semibold tg-text">{{ details.displayName }}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <PlatformBadge :platform="details.platform" />
          <StatusBadge :status="details.online" />
        </div>
        <p class="mt-2 text-xs tg-hint">
          {{ t("details.follow_date", { date: formatDate(details.followDate) }) }}
        </p>
        <p class="mt-1 text-xs tg-hint">
          {{ details.platform === "twitch" ? t("details.twitch_full") : t("details.kick_limited") }}
        </p>
      </header>

      <section v-if="live && live.status === 'online'" class="rounded-xl p-4 tg-card">
        <h2 class="text-sm font-semibold tg-text">{{ t("details.status") }}</h2>
        <dl class="mt-2 space-y-1 text-sm tg-text">
          <div v-if="live.title">
            <dt class="sr-only">{{ t("details.stream_title") }}</dt>
            <dd>{{ t("details.stream_title", { title: live.title }) }}</dd>
          </div>
          <div v-if="live.viewers !== undefined">
            <dt class="sr-only">{{ t("details.viewers") }}</dt>
            <dd>{{ t("details.viewers", { count: live.viewers }) }}</dd>
          </div>
          <div v-if="live.category && capabilities.categoryChange">
            <dt class="sr-only">{{ t("details.category") }}</dt>
            <dd>{{ t("details.category", { name: live.category }) }}</dd>
          </div>
        </dl>
      </section>

      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="rounded-xl px-4 py-3 text-sm font-semibold tg-button"
          @click="openExternal(details.url)"
        >
          {{ t("details.open_channel") }}
        </button>
        <button
          type="button"
          class="rounded-xl px-4 py-3 text-sm font-medium tg-secondary tg-text"
          @click="share"
        >
          {{ t("details.share") }}
        </button>
        <button
          type="button"
          class="rounded-xl px-4 py-3 text-sm font-semibold tg-destructive"
          @click="confirming = true"
        >
          {{ t("details.remove") }}
        </button>
      </div>

      <p v-if="confirming" class="rounded-xl p-3 text-sm tg-card tg-text">
        {{ t("details.remove_confirm", { name: details.displayName }) }}
        <span class="mt-2 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold tg-destructive"
            :disabled="busy"
            @click="confirmRemove"
          >
            {{ t("common.remove") }}
          </button>
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium tg-secondary tg-text"
            @click="confirming = false"
          >
            {{ t("common.cancel") }}
          </button>
        </span>
      </p>

      <p v-if="error" class="text-sm tg-destructive">{{ error }}</p>
    </template>
  </section>
</template>
