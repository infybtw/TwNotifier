<script setup lang="ts">
import type { Follow } from "~/composables/useFollows";

defineProps<{ follow: Follow }>();
</script>

<template>
  <NuxtLink
    :to="`/follow/${follow.platform}/${follow.channelId}`"
    class="flex items-center justify-between gap-3 rounded-xl px-3 py-3 tg-card"
  >
    <span class="flex min-w-0 flex-col gap-1">
      <span class="truncate text-sm font-semibold tg-text">{{ follow.displayName }}</span>
      <span class="flex flex-wrap items-center gap-1.5">
        <PlatformBadge :platform="follow.platform" />
        <StatusBadge :status="follow.online" />
      </span>
    </span>
    <span class="text-lg tg-hint" aria-hidden="true">›</span>
  </NuxtLink>
</template>
