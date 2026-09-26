<script setup lang="ts">
const { t } = useLocale();
const { authError, signingIn, signIn } = useAuth();
const { state } = useTelegram();
const config = useRuntimeConfig();

const botUrl = computed(() =>
  config.public.botUsername ? `https://t.me/${config.public.botUsername}` : "",
);

const needsReopen = computed(() => authError.value === "no_init_data" || authError.value === "expired");
const showFailure = computed(() => authError.value === "failed" || authError.value === "network");

onMounted(() => {
  if (state.available && state.initData && !signingIn.value) {
    void signIn();
  }
});
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
    <template v-if="signingIn">
      <LoadingState :message="t('onboarding.signing_in')" />
    </template>

    <template v-else-if="!state.available">
      <span class="text-4xl" aria-hidden="true">✈️</span>
      <h1 class="text-xl font-semibold tg-text">{{ t("onboarding.open_title") }}</h1>
      <p class="tg-hint">{{ t("onboarding.open_body") }}</p>
      <a
        v-if="botUrl"
        :href="botUrl"
        target="_blank"
        rel="noopener"
        class="rounded-xl px-5 py-3 text-sm font-semibold tg-button"
      >
        {{ t("onboarding.open_button") }}
      </a>
    </template>

    <template v-else-if="needsReopen">
      <span class="text-4xl" aria-hidden="true">🔄</span>
      <p class="tg-hint">{{ t("onboarding.expired") }}</p>
      <button
        type="button"
        class="rounded-xl px-5 py-3 text-sm font-semibold tg-button"
        @click="signIn"
      >
        {{ t("onboarding.retry") }}
      </button>
    </template>

    <template v-else-if="showFailure">
      <span class="text-4xl" aria-hidden="true">⚠️</span>
      <p class="tg-hint">
        {{ authError === "network" ? t("onboarding.network") : t("onboarding.failed") }}
      </p>
      <button
        type="button"
        class="rounded-xl px-5 py-3 text-sm font-semibold tg-button"
        @click="signIn"
      >
        {{ t("onboarding.retry") }}
      </button>
    </template>

    <template v-else>
      <button
        type="button"
        class="rounded-xl px-5 py-3 text-sm font-semibold tg-button"
        @click="signIn"
      >
        {{ t("onboarding.signing_in") }}
      </button>
    </template>
  </div>
</template>
