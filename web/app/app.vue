<script setup lang="ts">
const { t, locale } = useLocale();
const { isAuthenticated } = useAuth();

useHead(() => ({ htmlAttrs: { lang: locale.value } }));
</script>

<template>
  <div class="min-h-[100dvh] tg-bg">
    <template v-if="isAuthenticated">
      <AppHeader />
      <main class="mx-auto max-w-2xl px-3 pb-24 pt-3">
        <DeliveryBanner />
        <NuxtPage />
      </main>
      <BottomNav />
    </template>
    <OnboardingScreen v-else />
  </div>
</template>
