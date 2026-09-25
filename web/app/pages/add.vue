<script setup lang="ts">
import { useApiError } from "~/composables/useApi";
import type { ChannelMatch } from "~/composables/useFollows";

const { t } = useLocale();
const localizeError = useApiError();
const { resolve, addFollow } = useFollows();
const { openExternal } = useTelegram();

const query = ref("");
const busy = ref(false);
const adding = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const matches = ref<ChannelMatch[]>([]);
const selected = ref<ChannelMatch | null>(null);

function reset(): void {
  matches.value = [];
  selected.value = null;
  notice.value = null;
}

async function search(): Promise<void> {
  const input = query.value.trim();
  if (!input || busy.value) return;
  busy.value = true;
  error.value = null;
  notice.value = null;
  selected.value = null;
  try {
    const response = await resolve(input);
    matches.value = response.matches;
    if (response.matches.length === 0) {
      error.value = response.unavailablePlatforms.length > 0
        ? t("add.provider_unavailable")
        : t("add.not_found");
      return;
    }
    const fresh = response.matches.filter((match) => !match.alreadyFollowing);
    if (fresh.length === 0) {
      notice.value = t("add.already", { name: response.matches[0]!.displayName });
      return;
    }
    if (fresh.length === 1) {
      selected.value = fresh[0]!;
    }
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    busy.value = false;
  }
}

async function confirmAdd(): Promise<void> {
  const match = selected.value;
  if (!match || adding.value) return;
  adding.value = true;
  error.value = null;
  try {
    const result = await addFollow(match.platform, match.channelId, match.login);
    notice.value = result.isNew
      ? t("add.success", { name: match.displayName })
      : t("add.already", { name: match.displayName });
    reset();
    query.value = "";
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h1 class="text-lg font-semibold tg-text">{{ t("add.title") }}</h1>

    <form class="flex gap-2" @submit.prevent="search">
      <input
        v-model="query"
        type="text"
        class="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm tg-card tg-text"
        :placeholder="t('add.placeholder')"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        enterkeyhint="search"
      >
      <button
        type="submit"
        class="rounded-xl px-4 py-2 text-sm font-semibold tg-button"
        :disabled="busy || !query.trim()"
      >
        {{ t("add.submit") }}
      </button>
    </form>

    <p v-if="notice" class="rounded-xl px-3 py-2 text-sm tg-card tg-text">{{ notice }}</p>
    <p v-if="error" class="rounded-xl px-3 py-2 text-sm tg-card tg-destructive">{{ error }}</p>
    <LoadingState v-if="busy" :message="t('add.resolving')" />

    <div v-if="matches.length > 1 && !selected" class="flex flex-col gap-2">
      <p class="text-sm tg-hint">{{ t("add.choose_platform") }}</p>
      <button
        v-for="match in matches"
        :key="`${match.platform}:${match.channelId}`"
        type="button"
        class="flex items-center justify-between gap-2 rounded-xl px-3 py-3 tg-card text-left"
        :disabled="match.alreadyFollowing"
        @click="selected = match"
      >
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-semibold tg-text">{{ match.displayName }}</span>
          <PlatformBadge :platform="match.platform" />
        </span>
        <span v-if="match.alreadyFollowing" class="text-xs tg-hint">{{ t("add.already_short") }}</span>
        <span v-else class="text-xs font-medium tg-link">{{ t("add.confirm") }}</span>
      </button>
    </div>

    <div v-if="selected" class="rounded-xl p-3 tg-card">
      <p class="text-sm font-medium tg-text">{{ t("add.preview", { name: selected.displayName }) }}</p>
      <div class="mt-1"><PlatformBadge :platform="selected.platform" /></div>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold tg-button"
          :disabled="adding"
          @click="confirmAdd"
        >
          {{ t("add.confirm") }}
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium tg-secondary tg-text"
          @click="reset"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium tg-secondary tg-text"
          @click="openExternal(selected.url)"
        >
          {{ t("common.open") }}
        </button>
      </div>
    </div>
  </section>
</template>
