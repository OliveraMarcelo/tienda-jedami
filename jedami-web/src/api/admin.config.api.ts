import apiClient from './client'
import type { BrandingConfig } from './config.api'

export interface ConfigTypeItem {
  id: number
  code: string
  label: string
  active: boolean
}

export interface SizeItem {
  id: number
  label: string
  sort_order: number
}

export interface ColorItem {
  id: number
  name: string
  hex_code: string | null
}

// ─── Purchase Types ──────────────────────────────────────────────────────────

export async function fetchPurchaseTypes(): Promise<ConfigTypeItem[]> {
  const res = await apiClient.get<{ data: ConfigTypeItem[] }>('/config/purchase-types')
  return res.data.data
}

export async function createPurchaseType(data: { code: string; label: string }): Promise<ConfigTypeItem> {
  const res = await apiClient.post<{ data: ConfigTypeItem }>('/config/purchase-types', data)
  return res.data.data
}

export async function updatePurchaseType(id: number, data: { label?: string; active?: boolean }): Promise<ConfigTypeItem> {
  const res = await apiClient.patch<{ data: ConfigTypeItem }>(`/config/purchase-types/${id}`, data)
  return res.data.data
}

// ─── Customer Types ──────────────────────────────────────────────────────────

export async function fetchCustomerTypes(): Promise<ConfigTypeItem[]> {
  const res = await apiClient.get<{ data: ConfigTypeItem[] }>('/config/customer-types')
  return res.data.data
}

export async function createCustomerType(data: { code: string; label: string }): Promise<ConfigTypeItem> {
  const res = await apiClient.post<{ data: ConfigTypeItem }>('/config/customer-types', data)
  return res.data.data
}

export async function updateCustomerType(id: number, data: { label?: string; active?: boolean }): Promise<ConfigTypeItem> {
  const res = await apiClient.patch<{ data: ConfigTypeItem }>(`/config/customer-types/${id}`, data)
  return res.data.data
}

// ─── Sizes ───────────────────────────────────────────────────────────────────

export async function fetchSizes(): Promise<SizeItem[]> {
  const res = await apiClient.get<{ data: SizeItem[] }>('/products/sizes')
  return res.data.data
}

export async function createSize(data: { label: string; sortOrder?: number }): Promise<SizeItem> {
  const res = await apiClient.post<{ data: SizeItem }>('/products/sizes', data)
  return res.data.data
}

export async function deleteSize(id: number): Promise<void> {
  await apiClient.delete(`/products/sizes/${id}`)
}

// ─── Colors ──────────────────────────────────────────────────────────────────

export async function fetchColors(): Promise<ColorItem[]> {
  const res = await apiClient.get<{ data: ColorItem[] }>('/products/colors')
  return res.data.data
}

export async function createColor(data: { name: string; hexCode?: string }): Promise<ColorItem> {
  const res = await apiClient.post<{ data: ColorItem }>('/products/colors', data)
  return res.data.data
}

export async function deleteColor(id: number): Promise<void> {
  await apiClient.delete(`/products/colors/${id}`)
}

// ─── Payment Gateway ─────────────────────────────────────────────────────────

export async function updatePaymentGateway(gateway: 'checkout_pro' | 'checkout_api' | 'bank_transfer'): Promise<{ paymentGateway: string }> {
  const res = await apiClient.patch<{ data: { paymentGateway: string } }>('/config/payment-gateway', { gateway })
  return res.data.data
}

// ─── Branding ────────────────────────────────────────────────────────────────

export async function updateBranding(data: Partial<BrandingConfig>): Promise<BrandingConfig> {
  const res = await apiClient.put<{ data: BrandingConfig }>('/config/branding', data)
  return res.data.data
}

export async function uploadBrandingLogo(file: File): Promise<BrandingConfig> {
  const form = new FormData()
  form.append('image', file)
  const res = await apiClient.post<{ data: BrandingConfig }>('/config/branding/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}
