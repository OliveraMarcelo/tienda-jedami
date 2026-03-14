import apiClient from './client'

export interface CustomerProfile {
  id: number
  customerType: 'retail' | 'wholesale'
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
