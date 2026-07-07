export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const { checkAuth } = useAuth()
  const ok = await checkAuth()
  if (!ok) {
    return navigateTo('/login')
  }
})
