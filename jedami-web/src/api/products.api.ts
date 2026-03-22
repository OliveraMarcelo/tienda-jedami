import apiClient from './client'
import type { Product, Category, Size, Color, PaginationMeta } from '@/types/api'

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
  search?: string | null,
): Promise<CatalogResponse> {
  const params: Record<string, unknown> = { page, pageSize }
  if (categoryId != null) params.categoryId = categoryId
  if (search) params.search = search
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

export async function fetchSizes(): Promise<{ data: Size[] }> {
  const res = await apiClient.get<{ data: Size[] }>('/products/sizes')
  return res.data
}

export async function fetchColors(): Promise<{ data: Color[] }> {
  const res = await apiClient.get<{ data: Color[] }>('/products/colors')
  return res.data
}
