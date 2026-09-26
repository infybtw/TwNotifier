<script setup lang="ts">
const props = withDefaults(defineProps<{
  url?: string | null;
  name: string;
  size?: number;
}>(), { size: 40 });

const failed = ref(false);
const showImage = computed(() => Boolean(props.url) && !failed.value);
const initial = computed(() => (props.name.trim().charAt(0) || "?").toUpperCase());
const dimension = computed(() => `${props.size}px`);
</script>

<template>
  <span
    class="relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full"
    :style="{ width: dimension, height: dimension }"
  >
    <img
      v-if="showImage"
      :src="url!"
      :alt="name"
      class="h-full w-full object-cover"
      loading="lazy"
      @error="failed = true"
    >
    <span
      v-else
      class="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
      style="background: linear-gradient(135deg, #7c3aed, #4c1d95)"
      aria-hidden="true"
    >
      {{ initial }}
    </span>
  </span>
</template>
