<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
    <div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Admin Login</h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Send <code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">/weblogin</code> to the bot and enter the code below
        </p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Login Code</label>
          <input
            v-model="code"
            type="text"
            maxlength="6"
            placeholder="000000"
            class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autofocus
          />
        </div>

        <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

        <button
          type="submit"
          :disabled="code.length !== 6 || loading"
          class="w-full inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Verifying...' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const route = useRoute()
const code = ref('')
const error = ref('')
const loading = ref(false)
const { login } = useAuth()

if (route.query.error === 'auth_required') {
  error.value = 'You need to authenticate to access this page'
}

async function handleLogin() {
  if (code.value.length !== 6) return
  loading.value = true
  error.value = ''
  try {
    await login(code.value)
    navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.error || e?.message || 'Invalid or expired code'
  } finally {
    loading.value = false
  }
}
</script>
