<template>
  <aside
    :class="[
      'bg-gray-900 text-gray-100 min-h-screen p-4 flex flex-col transition-all duration-200',
      collapsed ? 'w-16' : 'w-64',
    ]"
  >
    <div class="flex items-center justify-between mb-8" :class="collapsed ? 'px-0 justify-center' : 'px-2'">
      <span v-if="!collapsed" class="text-xl font-bold whitespace-nowrap">Admin Panel</span>
      <div class="flex items-center gap-1">
        <ThemeSwitcher v-if="!collapsed" />
        <button
          @click="toggle"
          class="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path v-if="collapsed" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
    </div>

    <nav class="space-y-1 flex-1">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="[
          'flex items-center rounded-lg hover:bg-gray-800 transition-colors',
          collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
        ]"
        active-class="bg-gray-800 text-white"
        :title="collapsed ? item.label : undefined"
      >
        <span v-html="item.icon" class="w-5 h-5 flex-shrink-0" />
        <span v-if="!collapsed" class="whitespace-nowrap">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <div v-if="collapsed" class="mt-auto flex justify-center">
      <ThemeSwitcher />
    </div>
  </aside>
</template>

<script setup lang="ts">
const { collapsed, toggle, init } = useSidebar()
onMounted(() => init())

const navItems = [
  { to: '/', label: 'Dashboard', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
  { to: '/users', label: 'Users', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { to: '/channels', label: 'Channels', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' },
  { to: '/follows', label: 'Follows', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
  { to: '/admin-keys', label: 'Admin Keys', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>' },
  { to: '/stream-logs', label: 'Stream Logs', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
]
</script>
