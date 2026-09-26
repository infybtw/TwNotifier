<script setup lang="ts">
const { t } = useLocale();

defineProps<{
  message?: string;
  actionLabel?: string;
  actionTo?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center gap-3 py-10 text-center">
    <span class="text-3xl" aria-hidden="true">📭</span>
    <p class="tg-hint">{{ message ?? t("common.empty") }}</p>
    <NuxtLink
      v-if="actionLabel && actionTo"
      :to="actionTo"
      class="rounded-lg px-4 py-2 text-sm font-medium tg-button"
    >
      {{ actionLabel }}
    </NuxtLink>
  </div>
</template>
