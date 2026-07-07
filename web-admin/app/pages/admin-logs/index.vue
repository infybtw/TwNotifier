<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Admin Logs</h1>
    <DataTable :columns="columns" :rows="logs ?? []" :loading="status === 'pending'" />
  </div>
</template>

<script setup lang="ts">
const { get } = useApi()
const { data: logs, status } = await useAsyncData('admin-logs', () => get<any[]>('/admin-logs'))

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'first_name', label: 'Admin' },
  { key: 'action', label: 'Action' },
  { key: 'details', label: 'Details' },
  { key: 'created', label: 'Created' },
]
</script>
