export function useApi() {
  const { getToken } = useAuth()
  const baseUrl = '/api/admin'

  function authHeaders(): Record<string, string> {
    const t = getToken()
    return t ? { Authorization: `Bearer ${t}` } : {}
  }

  async function get<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { headers: authHeaders() })
  }

  async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { method: 'POST', body, headers: authHeaders() })
  }

  async function put<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { method: 'PUT', body, headers: authHeaders() })
  }

  async function del<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { method: 'DELETE', headers: authHeaders() })
  }

  return { get, post, put, del }
}
