<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Channels</h1>
    </div>
    <DataTable :columns="columns" :rows="channels ?? []" :loading="status === 'pending'">
      <template #actions="{ row }">
        <NuxtLink :to="`/channels/${row.channel_id}`" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium">
          Edit
        </NuxtLink>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
const { get } = useApi()
const { data: channels, status } = await useAsyncData('channels', () => get<any[]>('/channels'))

const columns = [
  { key: 'channel_id', label: 'ID' },
  { key: 'channel_name', label: 'Name' },
  { key: 'platform', label: 'Platform' },
]
</script>
