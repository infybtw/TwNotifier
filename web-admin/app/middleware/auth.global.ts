export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return
  if (!import.meta.client) return

  const { checkAuth } = useAuth()
  const ok = await checkAuth()
  if (!ok) {
    return navigateTo('/login')
  }
})
