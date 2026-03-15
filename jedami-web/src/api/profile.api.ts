import apiClient from './client'
import type { CustomerType } from '@/lib/constants'

export interface CustomerProfile {
  id: number
  customerType: CustomerType
}

export interface MeResponse {
  id: number
  email: string
  roles: string[]
  customer: CustomerProfile | null
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await apiClient.get<{ data: MeResponse }>('/users/me')
  return res.data.data
}
