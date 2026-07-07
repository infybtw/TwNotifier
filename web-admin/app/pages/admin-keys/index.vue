<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Admin Keys</h1>
      <button class="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700" @click="showCreate = true">Generate Key</button>
    </div>
    <DataTable :columns="columns" :rows="keys ?? []" :loading="status === 'pending'" @row-click="openDetail">
      <template #actions="{ row }">
        <button class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium" @click.stop="handleDelete(row.id)">Delete</button>
      </template>
    </DataTable>

    <Modal :open="showDetail" title="Admin Key Details" @close="showDetail = false">
      <div v-if="selectedRow" class="space-y-3">
        <div v-for="col in columns" :key="col.key" class="flex justify-between text-sm">
          <span class="text-gray-500 dark:text-gray-400">{{ col.label }}</span>
          <span class="text-gray-900 dark:text-gray-100 font-medium break-all text-right ml-4">{{ selectedRow[col.key] }}</span>
        </div>
        <div class="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button class="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700" @click="showDetail = false; handleDelete(selectedRow.id)">Delete</button>
        </div>
      </div>
    </Modal>

    <Modal :open="showCreate" title="Generate Admin Key" @close="showCreate = false">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
          <div class="flex gap-2">
            <input v-model="newKey" type="text" placeholder="Enter key or generate one" class="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            <button class="px-3 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600" @click="generateKey">Generate</button>
          </div>
        </div>
        <button class="w-full px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" :disabled="!newKey" @click="handleCreate">Create</button>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
const { get, post, del } = useApi()
const { data: keys, status, refresh } = await useAsyncData('admin-keys', () => get<any[]>('/admin-keys'))

const showDetail = ref(false)
const selectedRow = ref<any>(null)
const showCreate = ref(false)
const newKey = ref('')

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'key', label: 'Key', truncate: 16 },
  { key: 'issue_date', label: 'Issued', truncate: 10 },
  { key: 'issued_by_name', label: 'Issued By' },
  { key: 'used', label: 'Used' },
  { key: 'used_date', label: 'Used Date', truncate: 10 },
]

function openDetail(row: any) { selectedRow.value = row; showDetail.value = true }
function generateKey() { const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; const arr = new Uint8Array(32); crypto.getRandomValues(arr); newKey.value = Array.from(arr, b => chars[b % chars.length]).join('') }
async function handleCreate() { await post('/admin-keys', { key: newKey.value }); newKey.value = ''; showCreate.value = false; refresh() }
async function handleDelete(id: number) { if (confirm('Delete this admin key?')) { await del(`/admin-keys/${id}`); refresh() } }
</script>
