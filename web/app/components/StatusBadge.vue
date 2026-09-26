<script setup lang="ts">
const { t } = useLocale();

defineProps<{
  status: "online" | "offline" | "unknown";
}>();
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
    :class="{
      'bg-red-500/15 text-red-400': status === 'online',
      'tg-secondary tg-hint': status === 'offline' || status === 'unknown',
    }"
  >
    <span aria-hidden="true">{{ status === "online" ? "🔴" : status === "offline" ? "⚪" : "❔" }}</span>
    {{ t(`status.${status}`) }}
  </span>
</template>
