export function useApi() {
  const baseUrl = '/api/admin'

  async function get<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`)
  }

  async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { method: 'POST', body })
  }

  async function put<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { method: 'PUT', body })
  }

  async function del<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}${path}`, { method: 'DELETE' })
  }

  return { get, post, put, del }
}
