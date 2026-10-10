<script setup lang="ts">
import type { Follow } from "~/composables/useFollows";

const { t } = useLocale();
const { loading, error, loadOnline } = useFollows();
const { openExternal } = useTelegram();

const items = ref<Follow[]>([]);
const checkedAt = ref<string | null>(null);

async function reload(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    items.value = await loadOnline();
    checkedAt.value = new Date().toISOString();
  } catch {
    error.value = t("common.error");
  } finally {
    loading.value = false;
  }
}

onMounted(() => void reload());
</script>

<template>
  <section class="flex flex-col gap-4">
    <header class="flex items-baseline justify-between gap-2">
      <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("online.title") }}</h1>
      <button type="button" class="text-xs font-medium tg-link" @click="reload">
        {{ t("common.refresh") }}
      </button>
    </header>

    <LoadingState v-if="loading" :message="t('online.checking')" />
    <ErrorState v-else-if="error" :message="error" @retry="reload" />
    <EmptyState v-else-if="items.length === 0" :message="t('online.empty')" />
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="follow in items"
        :key="`${follow.platform}:${follow.channelId}`"
        class="flex cursor-pointer flex-col gap-2.5 rounded-2xl p-4 tg-card"
        @click="navigateTo(`/follow/${follow.platform}/${follow.channelId}`)"
      >
        <StreamPreview
          v-if="follow.live?.previewUrl"
          :url="follow.live.previewUrl"
          :alt="follow.displayName"
        />
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 flex-col gap-1">
            <span class="truncate text-sm font-semibold tg-text">{{ follow.displayName }}</span>
            <span class="flex flex-wrap items-center gap-1.5">
              <PlatformBadge :platform="follow.platform" />
              <StatusBadge :status="follow.online" />
            </span>
          </div>
          <div class="flex shrink-0 gap-2">
            <button
              type="button"
              class="rounded-lg px-2.5 py-1.5 text-xs font-medium"
              :class="follow.platform === 'twitch' ? 'bg-violet-500/15 text-violet-400' : 'bg-green-500/15 text-green-400'"
              :aria-label="t('details.open_channel')"
              @click.stop="openExternal(follow.url)"
            >
              {{ t(`platform.${follow.platform}`) }}
            </button>
          </div>
        </div>
        <dl v-if="follow.live && follow.live.status === 'online'" class="space-y-1 text-xs tg-hint">
          <div v-if="follow.live.title">
            <dt class="sr-only">{{ t("details.stream_title") }}</dt>
            <dd class="truncate">{{ t("details.stream_title", { title: follow.live.title }) }}</dd>
          </div>
          <div v-if="follow.live.viewers !== undefined">
            <dt class="sr-only">{{ t("details.viewers") }}</dt>
            <dd>{{ t("details.viewers", { count: follow.live.viewers }) }}</dd>
          </div>
        </dl>
      </li>
    </ul>
  </section>
</template>
