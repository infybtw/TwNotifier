<script setup lang="ts">
const { t } = useLocale();
const { profile, refreshProfile } = useAuth();
const { state, requestWriteAccess } = useTelegram();
const config = useRuntimeConfig();

const busy = ref(false);
const botUrl = computed(() =>
  config.public.botUsername ? `https://t.me/${config.public.botUsername}` : "",
);

const blocked = computed(() => profile.value?.chatDelivery === "blocked");
const visible = computed(() => Boolean(profile.value && profile.value.chatDelivery !== "enabled"));

async function enable(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    if (state.available) {
      // A client-side signal; the backend trusts the server-side update it
      // receives from Telegram, not this callback.
      await requestWriteAccess();
    }
    await refreshProfile().catch(() => undefined);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="mb-4 rounded-2xl p-4 tg-card"
  >
    <p class="text-sm font-medium tg-text">
      {{ blocked ? t("onboarding.notifications_blocked") : t("onboarding.notifications_unknown") }}
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button
        v-if="!blocked && state.available"
        type="button"
        class="rounded-lg px-3 py-2 text-xs font-semibold tg-button"
        :disabled="busy"
        @click="enable"
      >
        {{ t("onboarding.enable_notifications") }}
      </button>
      <a
        v-if="botUrl"
        :href="botUrl"
        target="_blank"
        rel="noopener"
        class="rounded-lg px-3 py-2 text-xs font-semibold tg-secondary tg-text"
      >
        {{ t("onboarding.open_chat") }}
      </a>
    </div>
  </div>
</template>
