export interface Variant {
  id: number
  size: string
  color: string
  retailPrice: number
  stock: { quantity: number }
}

export interface Product {
  id: number
  name: string
  description: string | null
  variants: Variant[]
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
}
