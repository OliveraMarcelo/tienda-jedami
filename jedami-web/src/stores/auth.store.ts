import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, registerApi, refreshApi, logoutApi } from '@/api/auth.api'
import { ROLES, MODES, CUSTOMER_TYPES, type Mode, type CustomerType } from '@/lib/constants'

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

  // Modo de visualización de precios — independiente del rol, persistido
  const storedViewMode = localStorage.getItem('jedami_view_mode') as Mode | null
  const viewMode = ref<Mode>(storedViewMode ?? (parsedUser?.roles.includes(ROLES.WHOLESALE) ? MODES.WHOLESALE : MODES.RETAIL))

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.roles.includes(ROLES.ADMIN) ?? false)
  const isWholesale = computed(() => user.value?.roles.includes(ROLES.WHOLESALE) ?? false)
  const isRetail = computed(() => user.value?.roles.includes(ROLES.RETAIL) ?? false)
  const mode = computed<Mode>(() => viewMode.value)

  function toggleMode() {
    viewMode.value = viewMode.value === MODES.RETAIL ? MODES.WHOLESALE : MODES.RETAIL
    localStorage.setItem('jedami_view_mode', viewMode.value)
  }

  function setToken(t: string, rt?: string) {
    token.value = t
    user.value = parseJwtPayload(t)
    if (!user.value) return // token inválido — no persistir
    localStorage.setItem('jedami_token', t)
    if (rt) {
      refreshToken.value = rt
      localStorage.setItem('jedami_refresh_token', rt)
    }
    // Al hacer login, si no hay preferencia guardada, usar el modo del rol
    if (!localStorage.getItem('jedami_view_mode')) {
      viewMode.value = user.value.roles.includes(ROLES.WHOLESALE) ? MODES.WHOLESALE : MODES.RETAIL
    }
  }

  function clearToken() {
    token.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem('jedami_token')
    localStorage.removeItem('jedami_refresh_token')
    viewMode.value = MODES.RETAIL
    localStorage.removeItem('jedami_view_mode')
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

  async function login(email: string, password: string, navigate = true) {
    const res = await loginApi(email, password)
    setToken(res.data.token, res.data.refreshToken)
    if (navigate) {
      const { default: router } = await import('@/router')
      const payload = parseJwtPayload(res.data.token)
      if (payload?.roles.includes(ROLES.ADMIN)) {
        router.push('/admin')
      } else {
        router.push('/catalogo')
      }
    }
  }

  async function register(email: string, password: string, customerType: CustomerType = CUSTOMER_TYPES.RETAIL, navigate = true) {
    await registerApi(email, password, customerType)
    // Si el registro fue exitoso pero el login falla, marcamos el error para que
    // el componente pueda distinguirlo de un error de registro (ej: email duplicado)
    try {
      await login(email, password, navigate)
    } catch (loginErr) {
      const err = loginErr as Record<string, unknown>
      err.__registerOk = true
      throw err
    }
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
    viewMode,
    toggleMode,
    login,
    register,
    logout,
    tryRefresh,
  }
})
