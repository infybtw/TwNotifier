<template>
  <div>
    <!-- Backdrop -->
    <div
      v-if="mobileOpen"
      class="fixed inset-0 bg-black/50 z-40 md:hidden"
      @click="$emit('close')"
    />

    <!-- Sidebar -->
    <aside
      :class="[
        'bg-gray-900 text-gray-100 min-h-screen p-4 flex flex-col transition-all duration-200 z-50',
        'fixed md:static inset-y-0 left-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        collapsed ? 'md:w-16' : 'md:w-64',
        mobileOpen ? 'w-64' : '',
      ]"
    >
      <div class="flex items-center justify-between mb-8" :class="collapsed ? 'md:px-0 md:justify-center px-2' : 'px-2'">
        <span v-if="!collapsed || mobileOpen" class="text-xl font-bold whitespace-nowrap">Admin Panel</span>
        <div class="flex items-center gap-1">
          <ThemeSwitcher v-if="!collapsed || mobileOpen" />
          <button
            @click="toggle"
            class="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white hidden md:block"
            :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path v-if="collapsed" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button
            @click="$emit('close')"
            class="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white md:hidden"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <nav class="space-y-1 flex-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          @click="$emit('close')"
          :class="[
            'flex items-center rounded-lg hover:bg-gray-800 transition-colors',
            (!collapsed || mobileOpen) ? 'gap-3 px-3 py-2' : 'justify-center px-2 py-2.5',
          ]"
          active-class="bg-gray-800 text-white"
          :title="collapsed && !mobileOpen ? item.label : undefined"
        >
          <span v-html="item.icon" class="w-5 h-5 flex-shrink-0" />
          <span v-if="!collapsed || mobileOpen" class="whitespace-nowrap">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="mt-auto space-y-2" :class="collapsed && !mobileOpen ? 'flex flex-col items-center' : ''">
        <ThemeSwitcher v-if="collapsed && !mobileOpen" />
        <button
          @click="handleLogout"
          :class="[
            'flex items-center rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-red-400 w-full',
            (!collapsed || mobileOpen) ? 'gap-3 px-3 py-2' : 'justify-center px-2 py-2.5',
          ]"
          title="Logout"
        >
          <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span v-if="!collapsed || mobileOpen" class="whitespace-nowrap">Logout</span>
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
defineProps<{ mobileOpen: boolean }>()
defineEmits<{ close: [] }>()

const { collapsed, toggle, init } = useSidebar()
const { logout } = useAuth()
onMounted(() => init())

function handleLogout() {
  logout()
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
  { to: '/users', label: 'Users', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { to: '/channels', label: 'Channels', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' },
  { to: '/follows', label: 'Follows', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
  { to: '/admin-keys', label: 'Admin Keys', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>' },
  { to: '/stream-logs', label: 'Stream Logs', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  { to: '/broadcast', label: 'Broadcast', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>' },
  { to: '/eventsub', label: 'EventSub', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>' },
  { to: '/webhooks', label: 'Webhooks', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' },
  { to: '/admin-logs', label: 'Admin Logs', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
]
</script>
