export function useApi() {
  const baseUrl = '/api/admin'
  const fetch = useRequestFetch()

  function handleError(err: any) {
    if (err?.status === 401 || err?.statusCode === 401 || err?.response?.status === 401) {
      navigateTo('/login?error=auth_required')
    }
    throw err
  }

  async function get<T>(path: string): Promise<T> {
    try { return await fetch<T>(`${baseUrl}${path}`) } catch (e: any) { handleError(e) }
  }

  async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    try { return await fetch<T>(`${baseUrl}${path}`, { method: 'POST', body }) } catch (e: any) { handleError(e) }
  }

  async function put<T>(path: string, body: Record<string, unknown>): Promise<T> {
    try { return await fetch<T>(`${baseUrl}${path}`, { method: 'PUT', body }) } catch (e: any) { handleError(e) }
  }

  async function del<T>(path: string): Promise<T> {
    try { return await fetch<T>(`${baseUrl}${path}`, { method: 'DELETE' }) } catch (e: any) { handleError(e) }
  }

  return { get, post, put, del }
}
