import apiClient from './client'
import type { Product, Variant } from '@/types/api'

interface CreateProductDTO {
  name: string
  description?: string
  categoryId?: number | null
}

interface UpdateProductDTO {
  name?: string
  description?: string
  categoryId?: number | null
}

interface CreateVariantDTO {
  size: string
  color: string
  retailPrice: number
  wholesalePrice?: number | null
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

export async function addImage(
  productId: number,
  url: string,
  position?: number,
): Promise<{ data: { id: number; productId: number; url: string; position: number } }> {
  const res = await apiClient.post(`/products/${productId}/images`, { url, position })
  return res.data
}

export async function fetchProductDetail(id: number): Promise<{ data: { images: { id: number; url: string; position: number }[] } }> {
  const res = await apiClient.get(`/products/${id}`)
  return res.data
}

export async function deleteImage(productId: number, imageId: number): Promise<void> {
  await apiClient.delete(`/products/${productId}/images/${imageId}`)
}
