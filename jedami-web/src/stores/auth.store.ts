import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, registerApi, refreshApi, logoutApi } from '@/api/auth.api'

interface JwtPayload {
  id: number
  email: string
  roles: string[]
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return null
    return JSON.parse(atob(base64)) as JwtPayload
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const storedToken = localStorage.getItem('jedami_token')
  // Si el token guardado está corrupto, limpiarlo silenciosamente
  const parsedUser = storedToken ? parseJwtPayload(storedToken) : null
  if (storedToken && !parsedUser) {
    localStorage.removeItem('jedami_token')
    localStorage.removeItem('jedami_refresh_token')
  }

  const token = ref<string | null>(parsedUser ? storedToken : null)
  const refreshToken = ref<string | null>(parsedUser ? localStorage.getItem('jedami_refresh_token') : null)
  const user = ref<JwtPayload | null>(parsedUser)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.roles.includes('admin') ?? false)
  const isWholesale = computed(() => user.value?.roles.includes('wholesale') ?? false)
  const isRetail = computed(() => user.value?.roles.includes('retail') ?? false)
  const mode = computed<'retail' | 'wholesale'>(() =>
    isWholesale.value ? 'wholesale' : 'retail'
  )

  function setToken(t: string, rt?: string) {
    token.value = t
    user.value = parseJwtPayload(t)
    if (!user.value) return // token inválido — no persistir
    localStorage.setItem('jedami_token', t)
    if (rt) {
      refreshToken.value = rt
      localStorage.setItem('jedami_refresh_token', rt)
    }
  }

  function clearToken() {
    token.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem('jedami_token')
    localStorage.removeItem('jedami_refresh_token')
  }

  async function tryRefresh(): Promise<boolean> {
    const rt = refreshToken.value
    if (!rt) return false
    try {
      const res = await refreshApi(rt)
      setToken(res.data.token, res.data.refreshToken)
      return true
    } catch {
      clearToken()
      return false
    }
  }

  async function login(email: string, password: string) {
    const res = await loginApi(email, password)
    setToken(res.data.token, res.data.refreshToken)
    const { default: router } = await import('@/router')
    const payload = parseJwtPayload(res.data.token)
    if (payload?.roles.includes('admin')) {
      router.push('/admin')
    } else {
      router.push('/catalogo')
    }
  }

  async function register(email: string, password: string) {
    await registerApi(email, password)
    await login(email, password)
  }

  async function logout() {
    try {
      await logoutApi()
    } catch {
      // silencioso — igual limpiamos local
    }
    clearToken()
    import('@/router').then(({ default: router }) => {
      router.push('/login')
    })
  }

  return {
    token,
    refreshToken,
    user,
    isAuthenticated,
    isAdmin,
    isWholesale,
    isRetail,
    mode,
    login,
    register,
    logout,
    tryRefresh,
  }
})
