import apiClient from './client'
import type { CustomerType } from '@/lib/constants'

export interface AuthTokens {
  token: string
  refreshToken: string
}

interface LoginResponse {
  data: AuthTokens
}

export interface RegisterResult {
  id: number
  email: string
  createdAt: string
  /** true: se mandó un código al email y hay que confirmarlo antes de entrar */
  verificationRequired: boolean
}

interface RegisterResponse {
  data: RegisterResult
}

interface RefreshResponse {
  data: AuthTokens
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', { email, password })
  return res.data
}

export async function registerApi(email: string, password: string, customerType: CustomerType): Promise<RegisterResponse> {
  const res = await apiClient.post<RegisterResponse>('/auth/register', { email, password, customerType })
  return res.data
}

export async function refreshApi(refreshToken: string): Promise<RefreshResponse> {
  const res = await apiClient.post<RefreshResponse>('/auth/refresh', { refreshToken })
  return res.data
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function verifyEmailApi(email: string, code: string): Promise<AuthTokens> {
  const res = await apiClient.post<{ data: AuthTokens }>('/auth/verify-email', { email, code })
  return res.data.data
}

export async function resendVerificationApi(email: string): Promise<void> {
  await apiClient.post('/auth/resend-verification', { email })
}

export async function forgotPasswordApi(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email })
}

export async function resetPasswordApi(token: string, password: string): Promise<AuthTokens> {
  const res = await apiClient.post<{ data: AuthTokens }>('/auth/reset-password', { token, password })
  return res.data.data
}

export async function googleLoginApi(credential: string, customerType?: CustomerType): Promise<AuthTokens> {
  const res = await apiClient.post<{ data: AuthTokens }>('/auth/google', { credential, customerType })
  return res.data.data
}
