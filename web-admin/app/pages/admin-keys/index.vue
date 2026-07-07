<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Admin Keys</h1>
      <Button @click="showCreate = true">Generate Key</Button>
    </div>
    <DataTable :columns="columns" :rows="keys ?? []" :loading="status === 'pending'">
      <template #actions="{ row }">
        <button
          class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
          @click="handleDelete(row.id)"
        >
          Delete
        </button>
      </template>
    </DataTable>

    <Modal :open="showCreate" title="Generate Admin Key" @close="showCreate = false">
      <div class="space-y-4">
        <Input v-model="newKey" label="Key" placeholder="Enter key string" />
        <Button @click="handleCreate">Create</Button>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
const { get, post, del } = useApi()
const { data: keys, status, refresh } = await useAsyncData('admin-keys', () => get<any[]>('/admin-keys'))

const showCreate = ref(false)
const newKey = ref('')

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'key', label: 'Key' },
  { key: 'issue_date', label: 'Issued' },
  { key: 'issued_by_name', label: 'Issued By' },
  { key: 'used', label: 'Used' },
  { key: 'used_date', label: 'Used Date' },
]

async function handleCreate() {
  await post('/admin-keys', { key: newKey.value })
  newKey.value = ''
  showCreate.value = false
  refresh()
}

async function handleDelete(id: number) {
  if (confirm('Delete this admin key?')) {
    await del(`/admin-keys/${id}`)
    refresh()
  }
}
</script>
