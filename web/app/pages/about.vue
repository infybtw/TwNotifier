<script setup lang="ts">
const { t } = useLocale();
const config = useRuntimeConfig();

const botUrl = computed(() =>
  config.public.botUsername ? `https://t.me/${config.public.botUsername}` : "",
);
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold tracking-tight tg-text">{{ t("about.title") }}</h1>

    <div class="flex flex-col gap-2.5 rounded-2xl p-4 tg-card">
      <p class="text-sm tg-text">{{ t("about.description") }}</p>
      <p class="text-sm tg-hint">{{ t("about.platforms") }}</p>
      <p class="text-sm tg-hint">{{ t("about.notifications") }}</p>
      <p class="text-sm tg-hint">{{ t("about.commands") }}</p>
    </div>

    <a
      href="https://github.com/infybtw/twnotifier"
      target="_blank"
      rel="noopener"
      class="rounded-xl px-4 py-3 text-center text-sm font-semibold tg-secondary tg-text"
    >
      {{ t("about.github") }}
    </a>

    <a
      v-if="botUrl"
      :href="botUrl"
      target="_blank"
      rel="noopener"
      class="rounded-xl px-4 py-3 text-center text-sm font-semibold tg-button"
    >
      {{ t("about.open_chat") }}
    </a>
  </section>
</template>
