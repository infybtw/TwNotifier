<script setup lang="ts">
defineProps<{
  label?: string;
}>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="label" class="text-xs tg-hint">{{ label }}</p>
    <div
      class="tg-progress h-1.5 w-full overflow-hidden rounded-full"
      role="progressbar"
      :aria-label="label"
    />
  </div>
</template>
