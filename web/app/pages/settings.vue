<script setup lang="ts">
import type { Settings } from "~/composables/useAuth";

const { t, locale } = useLocale();
const { settings, profile } = useAuth();
const { save, saving, error, saved } = useSettingsSave();
const config = useRuntimeConfig();

const botUrl = computed(() =>
  config.public.botUsername ? `https://t.me/${config.public.botUsername}` : "",
);

const deliveryLabel = computed(() => {
  switch (profile.value?.chatDelivery) {
    case "enabled": return t("settings.delivery_enabled");
    case "blocked": return t("settings.delivery_blocked");
    default: return t("settings.delivery_unknown");
  }
});

const toggles = computed(() => [
  { key: "onlineNotification" as const, label: t("settings.stream_start"), locked: false },
  { key: "offlineNotification" as const, label: t("settings.stream_end"), locked: false },
  { key: "titleChangeNotification" as const, label: t("settings.title_change"), locked: false },
  { key: "categoryChangeNotification" as const, label: t("settings.category_change"), locked: false },
  { key: "streamMetadata" as const, label: t("settings.stream_metadata"), locked: false },
  { key: "linkPreview" as const, label: t("settings.link_preview"), locked: false },
]);

function valueOf(key: keyof Settings): boolean {
  return Boolean(settings.value?.[key]);
}

function onToggle(key: keyof Settings, value: boolean): void {
  void save({ [key]: value } as Partial<Settings>);
}

function setLanguage(next: "ru" | "en"): void {
  void save({ language: next });
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h1 class="text-lg font-semibold tg-text">{{ t("settings.title") }}</h1>

    <div v-if="settings" class="flex flex-col gap-2">
      <SettingsToggle
        v-for="toggle in toggles"
        :key="toggle.key"
        :model-value="valueOf(toggle.key)"
        :label="toggle.label"
        :disabled="saving"
        @update:model-value="(value) => onToggle(toggle.key, value)"
      />
    </div>

    <p class="text-xs tg-hint">{{ t("settings.kick_note") }}</p>

    <div class="rounded-xl p-3 tg-card">
      <p class="text-sm font-medium tg-text">{{ t("settings.language") }}</p>
      <div class="mt-2 flex gap-2">
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium"
          :class="locale === 'ru' ? 'tg-button' : 'tg-secondary tg-text'"
          :aria-pressed="locale === 'ru'"
          @click="setLanguage('ru')"
        >
          🇷🇺 Русский
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium"
          :class="locale === 'en' ? 'tg-button' : 'tg-secondary tg-text'"
          :aria-pressed="locale === 'en'"
          @click="setLanguage('en')"
        >
          🇬🇧 English
        </button>
      </div>
    </div>

    <div class="rounded-xl p-3 tg-card">
      <p class="text-sm font-medium tg-text">{{ t("settings.chat_delivery") }}: {{ deliveryLabel }}</p>
      <p v-if="profile?.chatDelivery === 'blocked'" class="mt-1 text-xs tg-hint">
        {{ t("settings.delivery_blocked_hint") }}
      </p>
      <a
        v-if="botUrl && profile?.chatDelivery !== 'enabled'"
        :href="botUrl"
        target="_blank"
        rel="noopener"
        class="mt-2 inline-block rounded-lg px-3 py-2 text-xs font-semibold tg-secondary tg-text"
      >
        {{ t("onboarding.open_chat") }}
      </a>
    </div>

    <p v-if="error" class="text-sm tg-destructive">{{ error }}</p>
    <p v-else-if="saved" class="text-xs tg-hint">{{ t("common.saved") }}</p>
  </section>
</template>
