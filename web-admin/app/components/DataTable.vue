<template>
  <div class="overflow-x-auto bg-white dark:bg-gray-900 rounded-lg shadow">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          >
            {{ col.label }}
          </th>
          <th v-if="$slots.actions" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
        <tr v-if="loading">
          <td :colspan="columns.length + 1" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
            Loading...
          </td>
        </tr>
        <tr v-else-if="rows.length === 0">
          <td :colspan="columns.length + 1" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
            No data
          </td>
        </tr>
        <tr v-for="(row, i) in rows" :key="i" class="hover:bg-gray-50 dark:hover:bg-gray-800">
          <td v-for="col in columns" :key="col.key" class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
            {{ row[col.key] }}
          </td>
          <td v-if="$slots.actions" class="px-6 py-4 whitespace-nowrap text-right text-sm">
            <slot name="actions" :row="row" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  columns: { key: string; label: string }[]
  rows: Record<string, any>[]
  loading?: boolean
}>()
</script>
