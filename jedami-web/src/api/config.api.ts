import apiClient from './client'

export interface BrandingConfig {
  storeName: string
  primaryColor: string
  secondaryColor: string
  logoUrl: string | null
  bankTransferCvu: string | null
  bankTransferAlias: string | null
  bankTransferHolderName: string | null
  bankTransferBankName: string | null
  bankTransferNotes: string | null
  whatsappNumber: string | null
}

export interface ConfigItem {
  id: number
  code: string
  label: string
  icon: string | null
}

export interface RoleItem {
  id: number
  name: string
}

export interface PaymentGatewayRuleItem {
  gateway: string
  active: boolean
}

export interface AppConfig {
  roles: RoleItem[]
  priceModes: ConfigItem[]
  purchaseTypes: ConfigItem[]
  customerTypes: ConfigItem[]
  paymentGateway?: string
  paymentGatewayRules?: {
    retail: PaymentGatewayRuleItem[]
    wholesale: PaymentGatewayRuleItem[]
  }
  pointDevice?: { id: number; name: string } | null
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await apiClient.get<{ data: AppConfig }>('/config')
  return res.data.data
}

export async function fetchBranding(): Promise<BrandingConfig> {
  const res = await apiClient.get<{ data: BrandingConfig }>('/config/branding')
  return res.data.data
}
