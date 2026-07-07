export function useAuth() {
  const user = useState<{ user_id: number; username: string; is_admin: boolean } | null>('auth_user', () => null)
  const isAuthenticated = computed(() => !!user.value)

  async function checkAuth() {
    try {
      const fetch = useRequestFetch()
      const data = await fetch<{ user: { user_id: number; username: string; is_admin: boolean } }>('/api/auth/me')
      user.value = data.user
      return true
    } catch {
      user.value = null
      return false
    }
  }

  async function login(code: string) {
    const data = await $fetch<{ success: boolean; user: { user_id: number; username: string } }>('/api/auth/login', {
      method: 'POST',
      body: { code },
    })
    if (data.success) {
      await checkAuth()
    }
    return data
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    navigateTo('/login')
  }

  return { user, isAuthenticated, checkAuth, login, logout }
}
