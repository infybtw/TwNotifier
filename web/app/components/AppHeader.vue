<script setup lang="ts">
const { t } = useLocale();
const { profile, settings, saveSettings } = useAuth();

const switching = ref(false);

async function switchLanguage(): Promise<void> {
  if (switching.value) return;
  switching.value = true;
  try {
    await saveSettings({ language: settings.value?.language === "ru" ? "en" : "ru" });
  } catch {
    // The settings screen surfaces save errors; a failed quick switch is silent.
  } finally {
    switching.value = false;
  }
}
</script>

<template>
  <header class="sticky top-0 z-20 border-b tg-card safe-top px-3 py-2">
    <div
      class="mx-auto flex max-w-2xl items-center justify-between gap-2"
      style="border-color: color-mix(in srgb, var(--tg-hint) 20%, transparent)"
    >
      <NuxtLink to="/" class="flex items-center gap-2">
        <span class="text-lg" aria-hidden="true">📡</span>
        <span class="text-base font-semibold tg-text">TwNotifier</span>
      </NuxtLink>
      <div class="flex items-center gap-2">
        <span v-if="profile?.username" class="max-w-[10rem] truncate text-xs tg-hint">@{{ profile.username }}</span>
        <button
          type="button"
          class="rounded-lg px-2 py-1 text-xs font-medium tg-secondary tg-text"
          :disabled="switching"
          :aria-label="t('settings.language')"
          @click="switchLanguage"
        >
          {{ settings?.language === "ru" ? "RU" : "EN" }}
        </button>
      </div>
    </div>
  </header>
</template>
