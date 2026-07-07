<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Channel {{ channel?.channel_id }}</h1>
      <Button variant="danger" @click="handleDelete">Delete</Button>
    </div>
    <div v-if="channel" class="bg-white dark:bg-gray-900 rounded-lg shadow p-6 max-w-lg space-y-4">
      <Input v-model="form.channel_name" label="Channel Name" />
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platform</label>
        <select v-model="form.platform" class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm">
          <option value="twitch">Twitch</option>
          <option value="kick">Kick</option>
        </select>
      </div>
      <Button @click="handleSave">Save</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { get, put, del } = useApi()

const { data: channel } = await useAsyncData(`channel-${route.params.id}`, () => get<any>(`/channels/${route.params.id}`))

const form = reactive({
  channel_name: channel.value?.channel_name ?? '',
  platform: channel.value?.platform ?? 'twitch',
})

async function handleSave() {
  await put(`/channels/${route.params.id}`, { ...form })
  router.push('/channels')
}

async function handleDelete() {
  if (confirm('Delete this channel?')) {
    await del(`/channels/${route.params.id}`)
    router.push('/channels')
  }
}
</script>
