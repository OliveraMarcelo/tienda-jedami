import apiClient from './client'
import type { Product, Category, PaginationMeta } from '@/types/api'

interface CatalogResponse {
  data: Product[]
  meta: PaginationMeta
}

interface ProductResponse {
  data: Product
}

interface CategoriesResponse {
  data: Category[]
}

export async function fetchProducts(
  page = 1,
  pageSize = 20,
  categoryId?: number | null,
): Promise<CatalogResponse> {
  const params: Record<string, unknown> = { page, pageSize }
  if (categoryId != null) params.categoryId = categoryId
  const res = await apiClient.get<CatalogResponse>('/products', { params })
  return res.data
}

export async function fetchProduct(id: number): Promise<ProductResponse> {
  const res = await apiClient.get<ProductResponse>(`/products/${id}`)
  return res.data
}

export async function fetchCategories(): Promise<CategoriesResponse> {
  const res = await apiClient.get<CategoriesResponse>('/categories')
  return res.data
}
