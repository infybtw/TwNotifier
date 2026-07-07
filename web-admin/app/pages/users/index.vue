<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
    </div>
    <DataTable :columns="columns" :rows="users ?? []" :loading="status === 'pending'">
      <template #actions="{ row }">
        <div class="flex gap-3 justify-end">
          <button
            class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
            @click="openEdit(row)"
          >Edit</button>
          <button
            class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
            @click="handleDelete(row.user_id)"
          >Delete</button>
        </div>
      </template>
    </DataTable>

    <Modal :open="showEdit" title="Edit User" @close="showEdit = false">
      <div class="space-y-4">
        <Input v-model="editForm.username" label="Username" />
        <Input v-model="editForm.first_name" label="First Name" />
        <div class="flex items-center gap-2">
          <input id="is_admin" v-model="editForm.is_admin" type="checkbox" class="rounded" />
          <label for="is_admin" class="text-sm text-gray-700 dark:text-gray-300">Admin</label>
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
const { data: users, status, refresh } = await useAsyncData('users', () => get<any[]>('/users'))

const showEdit = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)
const editForm = reactive({ username: '', first_name: '', is_admin: false })

const columns = [
  { key: 'user_id', label: 'ID' },
  { key: 'username', label: 'Username' },
  { key: 'first_name', label: 'First Name' },
  { key: 'is_admin', label: 'Admin' },
  { key: 'created', label: 'Created' },
]

function openEdit(row: any) {
  editId.value = row.user_id
  editForm.username = row.username ?? ''
  editForm.first_name = row.first_name ?? ''
  editForm.is_admin = row.is_admin ?? false
  showEdit.value = true
}

async function handleSave() {
  if (!editId.value) return
  saving.value = true
  try {
    await put(`/users/${editId.value}`, { ...editForm })
    showEdit.value = false
    refresh()
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  if (confirm('Delete this user?')) {
    await del(`/users/${id}`)
    refresh()
  }
}
</script>
