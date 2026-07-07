<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Follows</h1>
    </div>
    <DataTable :columns="columns" :rows="follows ?? []" :loading="status === 'pending'" @row-click="openDetail">
      <template #actions="{ row }">
        <button class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium" @click.stop="handleDelete(row.user_id, row.channel_id)">Delete</button>
      </template>
    </DataTable>

    <Modal :open="showDetail" title="Follow Details" @close="showDetail = false">
      <div v-if="selectedRow" class="space-y-3">
        <div v-for="col in columns" :key="col.key" class="flex justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">{{ col.label }}</span>
          <span class="text-gray-900 dark:text-gray-100 font-medium break-all text-right ml-4">{{ selectedRow[col.key] }}</span>
        </div>
        <div class="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button class="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700" @click="showDetail = false; handleDelete(selectedRow.user_id, selectedRow.channel_id)">Delete</button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
const { get, del } = useApi()
const { data: follows, status, refresh } = await useAsyncData('follows', () => get<any[]>('/follows'))

const showDetail = ref(false)
const selectedRow = ref<any>(null)

const columns = [
  { key: 'user_id', label: 'User ID' },
  { key: 'username', label: 'Username' },
  { key: 'first_name', label: 'First Name' },
  { key: 'channel_id', label: 'Channel ID' },
  { key: 'channel_name', label: 'Channel' },
  { key: 'platform', label: 'Platform' },
  { key: 'created', label: 'Created', truncate: 10 },
]

function openDetail(row: any) { selectedRow.value = row; showDetail.value = true }
async function handleDelete(userId: number, channelId: number) { if (confirm('Delete this follow?')) { await del(`/follows/${userId}/${channelId}`); refresh() } }
</script>
