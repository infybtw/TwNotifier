<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Stream Logs</h1>
    <DataTable :columns="columns" :rows="logs ?? []" :loading="status === 'pending'" />
  </div>
</template>

<script setup lang="ts">
const { get } = useApi()
const { data: logs, status } = await useAsyncData('stream-logs', () => get<any[]>('/stream-logs'))

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'channel_name', label: 'Channel' },
  { key: 'platform', label: 'Platform' },
  { key: 'event', label: 'Event' },
  { key: 'created', label: 'Created' },
]
</script>
