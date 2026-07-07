<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Follows</h1>
    </div>
    <DataTable :columns="columns" :rows="follows ?? []" :loading="status === 'pending'">
      <template #actions="{ row }">
        <button
          class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
          @click="handleDelete(row.user_id, row.channel_id)"
        >
          Delete
        </button>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
const { get, del } = useApi()
const { data: follows, status, refresh } = await useAsyncData('follows', () => get<any[]>('/follows'))

const columns = [
  { key: 'user_id', label: 'User ID' },
  { key: 'username', label: 'Username' },
  { key: 'first_name', label: 'First Name' },
  { key: 'channel_id', label: 'Channel ID' },
  { key: 'channel_name', label: 'Channel' },
  { key: 'platform', label: 'Platform' },
  { key: 'created', label: 'Created' },
]

async function handleDelete(userId: number, channelId: number) {
  if (confirm('Delete this follow?')) {
    await del(`/follows/${userId}/${channelId}`)
    refresh()
  }
}
</script>
