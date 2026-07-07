<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">User Settings — {{ route.params.userId }}</h1>
    <div v-if="settings" class="bg-white dark:bg-gray-900 rounded-lg shadow p-6 max-w-lg space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Online Notification</label>
        <select v-model="form.online_notification" class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm">
          <option :value="1">Enabled</option>
          <option :value="0">Disabled</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Offline Notification</label>
        <select v-model="form.offline_notification" class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm">
          <option :value="1">Enabled</option>
          <option :value="0">Disabled</option>
        </select>
      </div>
      <Button @click="handleSave">Save</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { get, put } = useApi()

const { data: settings } = await useAsyncData(
  `settings-${route.params.userId}`,
  () => get<any>(`/users/${route.params.userId}/settings`)
)

const form = reactive({
  online_notification: settings.value?.online_notification ?? 1,
  offline_notification: settings.value?.offline_notification ?? 1,
})

async function handleSave() {
  await put(`/users/${route.params.userId}/settings`, { ...form })
}
</script>
