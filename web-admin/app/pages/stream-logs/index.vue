<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Stream Logs</h1>
    <DataTable :columns="columns" :rows="logs ?? []" :loading="status === 'pending'" @row-click="openDetail" />

    <Modal :open="showDetail" title="Stream Log Details" @close="showDetail = false">
      <div v-if="selectedRow" class="space-y-3">
        <div v-for="col in columns" :key="col.key" class="flex justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">{{ col.label }}</span>
          <span class="text-gray-900 dark:text-gray-100 font-medium break-all text-right ml-4">{{ selectedRow[col.key] }}</span>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
const { get } = useApi()
const { data: logs, status } = await useAsyncData('stream-logs', () => get<any[]>('/stream-logs'))

const showDetail = ref(false)
const selectedRow = ref<any>(null)

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'channel_name', label: 'Channel' },
  { key: 'platform', label: 'Platform' },
  { key: 'event', label: 'Event' },
  { key: 'created', label: 'Created', truncate: 10 },
]

function openDetail(row: any) { selectedRow.value = row; showDetail.value = true }
</script>
