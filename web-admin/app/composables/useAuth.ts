export function useAuth() {
  const user = useState<{ user_id: number; username: string; is_admin: boolean } | null>('auth_user', () => null)
  const token = useState<string | null>('auth_token', () => null)
  const isAuthenticated = computed(() => !!user.value)

  function getToken(): string | null {
    if (token.value) return token.value
    if (import.meta.client) {
      token.value = localStorage.getItem('auth_token')
    }
    return token.value
  }

  async function checkAuth() {
    const t = getToken()
    if (!t) {
      user.value = null
      return false
    }
    try {
      const data = await $fetch<{ user: { user_id: number; username: string; is_admin: boolean } }>('/api/auth/me', {
        headers: { Authorization: `Bearer ${t}` },
      })
      user.value = data.user
      return true
    } catch {
      user.value = null
      token.value = null
      if (import.meta.client) localStorage.removeItem('auth_token')
      return false
    }
  }

  async function login(code: string) {
    const data = await $fetch<{ success: boolean; token: string; user: { user_id: number; username: string } }>('/api/auth/login', {
      method: 'POST',
      body: { code },
    })
    if (data.success && data.token) {
      token.value = data.token
      if (import.meta.client) localStorage.setItem('auth_token', data.token)
      user.value = { ...data.user, is_admin: true }
    }
    return data
  }

  async function logout() {
    token.value = null
    user.value = null
    if (import.meta.client) localStorage.removeItem('auth_token')
    navigateTo('/login')
  }

  return { user, token, isAuthenticated, checkAuth, login, logout, getToken }
}
