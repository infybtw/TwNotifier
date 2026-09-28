<script setup lang="ts">
const props = defineProps<{
  url?: string | null;
  alt: string;
}>();

const failed = ref(false);
const show = computed(() => Boolean(props.url) && !failed.value);

watch(() => props.url, () => {
  failed.value = false;
});
</script>

<template>
  <img
    v-if="show"
    :src="url!"
    :alt="alt"
    class="aspect-video w-full rounded-xl object-cover tg-secondary"
    loading="lazy"
    @error="failed = true"
  >
</template>
