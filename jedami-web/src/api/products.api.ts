import apiClient from './client'
import type { Product, PaginationMeta } from '@/types/api'

interface CatalogResponse {
  data: Product[]
  meta: PaginationMeta
}

interface ProductResponse {
  data: Product
}

export async function fetchProducts(page = 1, pageSize = 20): Promise<CatalogResponse> {
  const res = await apiClient.get<CatalogResponse>('/products', { params: { page, pageSize } })
  return res.data
}

export async function fetchProduct(id: number): Promise<ProductResponse> {
  const res = await apiClient.get<ProductResponse>(`/products/${id}`)
  return res.data
}
