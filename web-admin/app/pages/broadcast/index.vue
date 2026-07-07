<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Broadcast</h1>
    <div class="bg-white dark:bg-gray-900 rounded-lg shadow p-6 max-w-lg space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
        <textarea
          v-model="message"
          rows="4"
          placeholder="Enter message to send to all users..."
          class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <p v-if="result" class="text-sm text-green-600 dark:text-green-400">
        Sent to {{ result.sent }} users, {{ result.failed }} failed
      </p>

      <button
        :disabled="!message || loading"
        class="w-full inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        @click="handleSend"
      >
        {{ loading ? 'Sending...' : 'Send Broadcast' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { post } = useApi()
const message = ref('')
const error = ref('')
const loading = ref(false)
const result = ref<{ sent: number; failed: number } | null>(null)

async function handleSend() {
  if (!message.value) return
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await post<{ sent: number; failed: number }>('/broadcast', { text: message.value })
    message.value = ''
  } catch (e: any) {
    error.value = e?.data?.error || 'Failed to send broadcast'
  } finally {
    loading.value = false
  }
}
</script>
