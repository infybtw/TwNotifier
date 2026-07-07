<template>
  <div class="flex min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Hamburger button for mobile -->
    <button
      @click="sidebarOpen = true"
      class="fixed top-4 left-4 z-30 p-2 rounded-lg bg-gray-900 text-gray-100 hover:bg-gray-800 transition-colors md:hidden"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <Sidebar :mobile-open="sidebarOpen" @close="sidebarOpen = false" />

    <main class="flex-1 p-4 md:p-8 pt-16 md:pt-8 overflow-x-hidden">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const sidebarOpen = ref(false)
</script>
