<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Channels</h1>
    </div>
    <DataTable :columns="columns" :rows="channels ?? []" :loading="status === 'pending'">
      <template #actions="{ row }">
        <div class="flex gap-3 justify-end">
          <button
            class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
            @click="openEdit(row)"
          >Edit</button>
          <button
            class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
            @click="handleDelete(row.channel_id)"
          >Delete</button>
        </div>
      </template>
    </DataTable>

    <Modal :open="showEdit" title="Edit Channel" @close="showEdit = false">
      <div class="space-y-4">
        <Input v-model="editForm.channel_name" label="Channel Name" />
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platform</label>
          <select v-model="editForm.platform" class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm">
            <option value="twitch">Twitch</option>
            <option value="kick">Kick</option>
          </select>
        </div>
        <div class="flex gap-2 justify-end">
          <button
            class="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
            @click="showEdit = false"
          >Cancel</button>
          <button
            class="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="saving"
            @click="handleSave"
          >{{ saving ? 'Saving...' : 'Save' }}</button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
const { get, put, del } = useApi()
const { data: channels, status, refresh } = await useAsyncData('channels', () => get<any[]>('/channels'))

const showEdit = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)
const editForm = reactive({ channel_name: '', platform: 'twitch' })

const columns = [
  { key: 'channel_id', label: 'ID' },
  { key: 'channel_name', label: 'Name' },
  { key: 'platform', label: 'Platform' },
]

function openEdit(row: any) {
  editId.value = row.channel_id
  editForm.channel_name = row.channel_name ?? ''
  editForm.platform = row.platform ?? 'twitch'
  showEdit.value = true
}

async function handleSave() {
  if (!editId.value) return
  saving.value = true
  try {
    await put(`/channels/${editId.value}`, { ...editForm })
    showEdit.value = false
    refresh()
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  if (confirm('Delete this channel?')) {
    await del(`/channels/${id}`)
    refresh()
  }
}
</script>
