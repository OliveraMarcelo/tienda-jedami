import { apiClient } from './client'

export interface ConfigItem {
  id: number
  code: string
  label: string
}

export interface RoleItem {
  id: number
  name: string
}

export interface AppConfig {
  roles: RoleItem[]
  priceModes: ConfigItem[]
  purchaseTypes: ConfigItem[]
  customerTypes: ConfigItem[]
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await apiClient.get<{ data: AppConfig }>('/config')
  return res.data.data
}
