<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">EventSub</h1>
      <div class="flex gap-2">
        <button class="px-3 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600" @click="handleCleanup" :disabled="loading">Cleanup</button>
        <button class="px-3 py-2 text-sm rounded-md bg-yellow-500 text-white hover:bg-yellow-600" @click="handleReload" :disabled="loading">Reload</button>
        <button class="px-3 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700" @click="handleDisconnect" :disabled="loading">Disconnect All</button>
      </div>
    </div>

    <p v-if="message" class="text-sm mb-4" :class="isError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">{{ message }}</p>

    <DataTable :columns="columns" :rows="subs ?? []" :loading="status === 'pending'" @row-click="openDetail" />

    <Modal :open="showDetail" title="EventSub Details" @close="showDetail = false">
      <div v-if="selectedRow" class="space-y-3">
        <div v-for="(value, key) in selectedRow" :key="key" class="flex justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">{{ key }}</span>
          <span class="text-gray-900 dark:text-gray-100 font-medium break-all text-right ml-4">{{ value }}</span>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
const { get, post } = useApi()
const { data: subs, status, refresh } = await useAsyncData('eventsub', () => get<any[]>('/eventsub'))

const loading = ref(false)
const message = ref('')
const isError = ref(false)
const showDetail = ref(false)
const selectedRow = ref<any>(null)

const columns = [
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'id', label: 'ID', truncate: 16 },
]

function openDetail(row: any) { selectedRow.value = row; showDetail.value = true }
async function handleReload() { loading.value = true; message.value = ''; isError.value = false; try { const res = await post<any>('/eventsub/reload', {}); message.value = `Reloaded: ${res.before} → ${res.after}`; refresh() } catch { message.value = 'Failed to reload'; isError.value = true } finally { loading.value = false } }
async function handleDisconnect() { if (!confirm('Delete ALL EventSub subscriptions?')) return; loading.value = true; message.value = ''; isError.value = false; try { const res = await post<any>('/eventsub/disconnect', {}); message.value = `Deleted ${res.deleted} subscriptions`; refresh() } catch { message.value = 'Failed to disconnect'; isError.value = true } finally { loading.value = false } }
async function handleCleanup() { loading.value = true; message.value = ''; isError.value = false; try { const res = await post<any>('/eventsub/cleanup', {}); message.value = `Total: ${res.total}, Removed: ${res.removed}, Remaining: ${res.remaining}`; refresh() } catch { message.value = 'Failed to cleanup'; isError.value = true } finally { loading.value = false } }
</script>
