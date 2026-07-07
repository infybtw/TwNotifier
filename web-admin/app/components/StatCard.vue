<template>
  <div class="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
    <div class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ title }}</div>
    <div class="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{{ value }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  value: string | number
}>()
</script>
