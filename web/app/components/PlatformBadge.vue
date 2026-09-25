<script setup lang="ts">
const { t } = useLocale();

defineProps<{
  platform: "twitch" | "kick";
}>();
</script>

<template>
  <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tg-secondary tg-text">
    <span aria-hidden="true" :class="platform === 'twitch' ? 'text-purple-500' : 'text-green-500'">●</span>
    {{ t(`platform.${platform}`) }}
  </span>
</template>
