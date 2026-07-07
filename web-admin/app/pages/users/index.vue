<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
    </div>
    <DataTable :columns="columns" :rows="users ?? []" :loading="status === 'pending'">
      <template #actions="{ row }">
        <NuxtLink :to="`/users/${row.user_id}`" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium">
          Edit
        </NuxtLink>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
const { get } = useApi()
const { data: users, status } = await useAsyncData('users', () => get<any[]>('/users'))

const columns = [
  { key: 'user_id', label: 'ID' },
  { key: 'username', label: 'Username' },
  { key: 'first_name', label: 'First Name' },
  { key: 'is_admin', label: 'Admin' },
  { key: 'created', label: 'Created' },
]
</script>
