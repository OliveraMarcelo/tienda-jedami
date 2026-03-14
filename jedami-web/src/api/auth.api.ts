import apiClient from './client'

interface LoginResponse {
  data: { token: string; refreshToken: string }
}

interface RegisterResponse {
  data: { id: number; email: string; createdAt: string }
}

interface RefreshResponse {
  data: { token: string; refreshToken: string }
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', { email, password })
  return res.data
}

export async function registerApi(email: string, password: string): Promise<RegisterResponse> {
  const res = await apiClient.post<RegisterResponse>('/auth/register', { email, password })
  return res.data
}

export async function refreshApi(refreshToken: string): Promise<RefreshResponse> {
  const res = await apiClient.post<RefreshResponse>('/auth/refresh', { refreshToken })
  return res.data
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout')
}
