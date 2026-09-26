<script setup lang="ts">
const { t } = useLocale();

defineProps<{
  message?: string;
}>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="flex flex-col items-center gap-3 py-10 text-center">
    <span class="text-3xl" aria-hidden="true">⚠️</span>
    <p class="tg-hint">{{ message ?? t("common.error") }}</p>
    <button
      type="button"
      class="rounded-lg px-4 py-2 text-sm font-medium tg-button"
      @click="emit('retry')"
    >
      {{ t("common.retry") }}
    </button>
  </div>
</template>
