<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="Users" :value="stats?.users ?? 0" />
      <StatCard title="Channels" :value="stats?.channels ?? 0" />
      <StatCard title="Follows" :value="stats?.follows ?? 0" />
      <StatCard title="Stream Logs" :value="stats?.streamLogs ?? 0" />
    </div>
  </div>
</template>

<script setup lang="ts">
const { get } = useApi()
const { data: stats } = await useAsyncData('stats', () => get<{ users: number; channels: number; follows: number; streamLogs: number }>('/stats'))
</script>
