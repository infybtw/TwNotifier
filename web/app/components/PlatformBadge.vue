<script setup lang="ts">
const { t } = useLocale();

defineProps<{
  platform: "twitch" | "kick";
}>();
</script>

<template>
  <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tg-secondary tg-text">
    <span aria-hidden="true" :class="platform === 'twitch' ? 'text-violet-400' : 'text-green-400'">●</span>
    {{ t(`platform.${platform}`) }}
  </span>
</template>
