import apiClient from './client'
import type { QuantityDiscountRule, CurvaDiscountRule } from '@/types/api'

export interface DiscountRulesResponse {
  quantityRules: QuantityDiscountRule[]
  curvaRules: CurvaDiscountRule[]
  minQuantityPurchase?: number | null
}

export interface CreateQuantityRuleDTO {
  minQuantity: number
  discountPct: number
}

export interface CreateCurvaRuleDTO {
  minCurves: number
  discountPct: number
}

export async function getPublicDiscountRules(productId: number): Promise<DiscountRulesResponse> {
  const res = await apiClient.get<{ data: DiscountRulesResponse }>(`/products/${productId}/discount-rules`)
  return res.data.data
}

export async function getAdminDiscountRules(productId: number): Promise<DiscountRulesResponse> {
  const res = await apiClient.get<{ data: DiscountRulesResponse }>(`/admin/products/${productId}/discount-rules`)
  return res.data.data
}

export async function createQuantityRule(
  productId: number,
  dto: CreateQuantityRuleDTO,
): Promise<QuantityDiscountRule> {
  const res = await apiClient.post<{ data: QuantityDiscountRule }>(
    `/admin/products/${productId}/discount-rules/quantity`,
    dto,
  )
  return res.data.data
}

export async function updateQuantityRule(
  productId: number,
  ruleId: number,
  dto: Partial<CreateQuantityRuleDTO>,
): Promise<QuantityDiscountRule> {
  const res = await apiClient.patch<{ data: QuantityDiscountRule }>(
    `/admin/products/${productId}/discount-rules/quantity/${ruleId}`,
    dto,
  )
  return res.data.data
}

export async function deleteQuantityRule(productId: number, ruleId: number): Promise<void> {
  await apiClient.delete(`/admin/products/${productId}/discount-rules/quantity/${ruleId}`)
}

export async function createCurvaRule(
  productId: number,
  dto: CreateCurvaRuleDTO,
): Promise<CurvaDiscountRule> {
  const res = await apiClient.post<{ data: CurvaDiscountRule }>(
    `/admin/products/${productId}/discount-rules/curva`,
    dto,
  )
  return res.data.data
}

export async function updateCurvaRule(
  productId: number,
  ruleId: number,
  dto: Partial<CreateCurvaRuleDTO>,
): Promise<CurvaDiscountRule> {
  const res = await apiClient.patch<{ data: CurvaDiscountRule }>(
    `/admin/products/${productId}/discount-rules/curva/${ruleId}`,
    dto,
  )
  return res.data.data
}

export async function deleteCurvaRule(productId: number, ruleId: number): Promise<void> {
  await apiClient.delete(`/admin/products/${productId}/discount-rules/curva/${ruleId}`)
}

export async function updateProductMinQuantity(
  productId: number,
  minQuantity: number | null,
): Promise<void> {
  await apiClient.patch(`/admin/products/${productId}/min-quantity`, { minQuantity })
}
