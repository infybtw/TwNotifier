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
  <header class="sticky top-0 z-20 border-b tg-bar safe-top" style="border-color: var(--tg-border)">
    <div class="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pb-3">
      <div class="flex min-w-0 items-center gap-2">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-2">
          <span class="text-lg" aria-hidden="true">📡</span>
          <span class="truncate text-base font-semibold tracking-tight tg-text">TwNotifier</span>
        </NuxtLink>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="profile?.username" class="max-w-[10rem] truncate text-xs tg-hint">@{{ profile.username }}</span>
        <button
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-semibold tg-secondary tg-text"
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
