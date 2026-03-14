import apiClient from './client'
import type { Product, Variant } from '@/types/api'

interface CreateProductDTO {
  name: string
  description?: string
}

interface UpdateProductDTO {
  name?: string
  description?: string
}

interface CreateVariantDTO {
  size: string
  color: string
  retailPrice: number
  initialStock: number
}

interface VariantWithProductId extends Variant {
  productId: number
}

export async function createProduct(dto: CreateProductDTO): Promise<{ data: Product }> {
  const res = await apiClient.post<{ data: Product }>('/products', dto)
  return res.data
}

export async function updateProduct(id: number, dto: UpdateProductDTO): Promise<{ data: Product }> {
  const res = await apiClient.put<{ data: Product }>(`/products/${id}`, dto)
  return res.data
}

export async function createVariant(productId: number, dto: CreateVariantDTO): Promise<{ data: VariantWithProductId }> {
  const res = await apiClient.post<{ data: VariantWithProductId }>(`/products/${productId}/variants`, dto)
  return res.data
}
