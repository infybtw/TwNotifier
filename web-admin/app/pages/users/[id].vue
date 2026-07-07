<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">User {{ user?.user_id }}</h1>
      <Button variant="danger" @click="handleDelete">Delete</Button>
    </div>
    <div v-if="user" class="bg-white dark:bg-gray-900 rounded-lg shadow p-6 max-w-lg space-y-4">
      <Input v-model="form.username" label="Username" />
      <Input v-model="form.first_name" label="First Name" />
      <div class="flex items-center gap-2">
        <input id="is_admin" v-model="form.is_admin" type="checkbox" class="rounded" />
        <label for="is_admin" class="text-sm text-gray-700 dark:text-gray-300">Admin</label>
      </div>
      <Button @click="handleSave">Save</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { get, put, del } = useApi()

const { data: user } = await useAsyncData(`user-${route.params.id}`, () => get<any>(`/users/${route.params.id}`))

const form = reactive({
  username: user.value?.username ?? '',
  first_name: user.value?.first_name ?? '',
  is_admin: user.value?.is_admin ?? false,
})

async function handleSave() {
  await put(`/users/${route.params.id}`, { ...form })
  router.push('/users')
}

async function handleDelete() {
  if (confirm('Delete this user?')) {
    await del(`/users/${route.params.id}`)
    router.push('/users')
  }
}
</script>
