export interface Variant {
  id: number
  size: string
  color: string
  retailPrice: number
  wholesalePrice: number | null
  stock: { quantity: number }
}

export interface Product {
  id: number
  name: string
  description: string | null
  categoryId: number | null
  categoryName: string | null
  imageUrl: string | null
  images?: { id: number; url: string; position: number }[]
  variants: Variant[]
}

export interface Category {
  id: number
  name: string
  slug: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  categoryId?: number | null
}
