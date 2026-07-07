export function useApi() {
  const config = useRuntimeConfig()
  const baseUrl = '/api/admin'

  async function get<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { baseURL: '/' })
  }

  async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { method: 'POST', body, baseURL: '/' })
  }

  async function put<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { method: 'PUT', body, baseURL: '/' })
  }

  async function del<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { method: 'DELETE', baseURL: '/' })
  }

  return { get, post, put, del }
}
