<script setup lang="ts">
const { t, locale } = useLocale();
const { isAuthenticated } = useAuth();
const route = useRoute();
const main = ref<HTMLElement | null>(null);

watch(() => route.fullPath, () => main.value?.scrollTo({ top: 0 }));

useHead(() => ({ htmlAttrs: { lang: locale.value } }));
</script>

<template>
  <div class="min-h-[100dvh] tg-bg" :class="{ 'app-shell': isAuthenticated }">
    <template v-if="isAuthenticated">
      <AppHeader />
      <main ref="main" class="app-main mx-auto w-full max-w-2xl px-4 py-4">
        <DeliveryBanner />
        <NuxtPage />
      </main>
      <BottomNav />
    </template>
    <OnboardingScreen v-else />
  </div>
</template>
