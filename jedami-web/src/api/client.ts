import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jedami_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

// Endpoints de auth donde un 401 significa "credenciales inválidas", no "sesión vencida"
const AUTH_NO_REFRESH = ['/auth/login', '/auth/register', '/auth/verify-email', '/auth/google', '/auth/reset-password']

// Una sola renovación a la vez: las requests que fallan con 401 mientras tanto esperan esta promesa
let refreshPromise: Promise<string | null> | null = null

async function doRefresh(failedToken: string | undefined): Promise<string | null> {
  const run = async (): Promise<string | null> => {
    // Otra pestaña (u otra request) ya renovó la sesión: usar ese token
    const current = localStorage.getItem('jedami_token')
    if (current && current !== failedToken) return current

    const { useAuthStore } = await import('@/stores/auth.store')
    const ok = await useAuthStore().tryRefresh()
    return ok ? localStorage.getItem('jedami_token') : null
  }
  // Web Locks: evita que dos pestañas usen el mismo refresh token a la vez (se rota en cada uso)
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('jedami-auth-refresh', run)
  }
  return run()
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error)
    }

    const url = originalRequest.url ?? ''
    if (AUTH_NO_REFRESH.some(path => url.includes(path))) {
      return Promise.reject(error)
    }

    // El refresh o el logout fallaron: la sesión ya no sirve
    if (url.includes('/auth/refresh') || url.includes('/auth/logout')) {
      const { useAuthStore } = await import('@/stores/auth.store')
      const { default: router } = await import('@/router')
      useAuthStore().logout()
      router.push('/login')
      return Promise.reject(error)
    }

    originalRequest._retry = true
    const failedToken = String(originalRequest.headers?.Authorization ?? '').replace(/^Bearer /, '') || undefined

    if (!refreshPromise) {
      refreshPromise = doRefresh(failedToken).finally(() => { refreshPromise = null })
    }
    const newToken = await refreshPromise

    if (newToken) {
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return apiClient(originalRequest)
    }

    const { default: router } = await import('@/router')
    router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    return Promise.reject(error)
  }
)

export default apiClient
