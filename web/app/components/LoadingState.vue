<script setup lang="ts">
const { t } = useLocale();

defineProps<{
  message?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center gap-3 py-10 text-center tg-hint">
    <span class="text-3xl" aria-hidden="true">⏳</span>
    <p>{{ message ?? t("common.loading") }}</p>
  </div>
</template>
