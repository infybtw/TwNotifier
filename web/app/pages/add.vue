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
/** Last successfully added channel, kept so the success card can show its avatar. */
const added = ref<ChannelMatch | null>(null);

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
  added.value = null;
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
    const message = result.isNew
      ? t("add.success", { name: match.displayName })
      : t("add.already", { name: match.displayName });
    reset();
    added.value = result.isNew ? match : null;
    notice.value = message;
    query.value = "";
  } catch (err) {
    error.value = localizeError(err);
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("add.title") }}</h1>

    <form class="flex gap-2" @submit.prevent="search">
      <input
        v-model="query"
        type="text"
        class="min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm tg-card tg-text placeholder:text-[var(--tg-hint)]"
        :placeholder="t('add.placeholder')"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        enterkeyhint="search"
      >
      <button
        type="submit"
        class="rounded-xl px-4 py-2.5 text-sm font-semibold tg-button"
        :disabled="busy || !query.trim()"
      >
        {{ t("add.submit") }}
      </button>
    </form>

    <div v-if="notice" class="flex items-center gap-3 rounded-2xl p-4 tg-card">
      <ChannelAvatar v-if="added" :url="added.avatarUrl" :name="added.displayName" :size="36" />
      <p class="min-w-0 text-sm tg-text">{{ notice }}</p>
    </div>
    <p v-if="error" class="rounded-2xl px-4 py-3 text-sm tg-card tg-destructive">{{ error }}</p>
    <LoadingState v-if="busy" :message="t('add.resolving')" />

    <div v-if="matches.length > 1 && !selected" class="flex flex-col gap-2">
      <p class="text-sm tg-hint">{{ t("add.choose_platform") }}</p>
      <button
        v-for="match in matches"
        :key="`${match.platform}:${match.channelId}`"
        type="button"
        class="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card text-left"
        :disabled="match.alreadyFollowing"
        @click="selected = match"
      >
        <span class="flex min-w-0 items-center gap-3">
          <ChannelAvatar :url="match.avatarUrl" :name="match.displayName" />
          <span class="flex min-w-0 flex-col gap-1">
            <span class="truncate text-sm font-semibold tg-text">{{ match.displayName }}</span>
            <PlatformBadge :platform="match.platform" />
          </span>
        </span>
        <span v-if="match.alreadyFollowing" class="shrink-0 text-xs tg-hint">{{ t("add.already_short") }}</span>
        <span v-else class="shrink-0 text-xs font-medium tg-link">{{ t("add.confirm") }}</span>
      </button>
    </div>

    <div v-if="selected" class="rounded-2xl p-4 tg-card">
      <div class="flex items-center gap-3">
        <ChannelAvatar :url="selected.avatarUrl" :name="selected.displayName" :size="48" />
        <div class="flex min-w-0 flex-col gap-1.5">
          <p class="truncate text-sm font-medium tg-text">{{ t("add.preview", { name: selected.displayName }) }}</p>
          <PlatformBadge :platform="selected.platform" />
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold tg-button"
          :disabled="adding"
          @click="confirmAdd"
        >
          {{ t("add.confirm") }}
        </button>
        <button
          type="button"
          class="rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text"
          @click="reset"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          type="button"
          class="rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text"
          :aria-label="t('common.open')"
          @click="openExternal(selected.url)"
        >
          {{ t("common.open") }}
        </button>
      </div>
    </div>
  </section>
</template>
