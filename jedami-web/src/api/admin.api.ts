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
  sizeId: number
  colorId: number
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

export async function updateProductPrices(
  id: number,
  dto: { retailPrice: number; wholesalePrice: number | null },
): Promise<void> {
  await apiClient.put(`/products/${id}/prices`, dto)
}

export async function createVariant(productId: number, dto: CreateVariantDTO): Promise<{ data: VariantWithProductId }> {
  const res = await apiClient.post<{ data: VariantWithProductId }>(`/products/${productId}/variants`, dto)
  return res.data
}

export async function uploadImage(
  productId: number,
  file: File,
  position?: number,
): Promise<{ data: { id: number; productId: number; url: string; position: number } }> {
  const form = new FormData()
  form.append('image', file)
  if (position != null) form.append('position', String(position))
  const res = await apiClient.post(`/products/${productId}/images/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function fetchProductDetail(id: number): Promise<{ data: { images: { id: number; url: string; position: number }[] } }> {
  const res = await apiClient.get(`/products/${id}`)
  return res.data
}

export async function deleteImage(productId: number, imageId: number): Promise<void> {
  await apiClient.delete(`/products/${productId}/images/${imageId}`)
}

export async function deleteProduct(id: number): Promise<void> {
  await apiClient.delete(`/products/${id}`)
}

export async function deleteVariant(productId: number, variantId: number): Promise<void> {
  await apiClient.delete(`/products/${productId}/variants/${variantId}`)
}

export async function updateStock(productId: number, variantId: number, quantity: number): Promise<void> {
  await apiClient.patch(`/products/${productId}/variants/${variantId}/stock`, { quantity })
}
