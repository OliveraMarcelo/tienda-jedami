export interface Size {
  id: number
  label: string
  sort_order: number
}

export interface Color {
  id: number
  name: string
  hex_code: string | null
}

export interface Variant {
  id: number
  sizeId: number
  size: string
  colorId: number
  color: string
  hexCode: string | null
  stock: { quantity: number }
}

export interface Product {
  id: number
  name: string
  description: string | null
  categoryId: number | null
  categoryName: string | null
  /** false = oculto en el catálogo público (solo lo ve el admin) */
  active?: boolean
  imageUrl: string | null
  retailPrice: number | null
  wholesalePrice: number | null
  images?: { id: number; url: string; position: number }[]
  variants: Variant[]
}

export interface Category {
  id: number
  name: string
  slug: string
  /** Productos visibles en la categoría (lo devuelve GET /categories) */
  productCount?: number
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  categoryId?: number | null
}

export interface QuantityDiscountRule {
  id: number
  product_id: number
  min_quantity: number
  discount_pct: number
  active: boolean
}

export interface CurvaDiscountRule {
  id: number
  product_id: number
  min_curves: number
  discount_pct: number
  active: boolean
}
