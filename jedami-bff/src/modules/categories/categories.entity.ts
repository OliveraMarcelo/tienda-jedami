export interface Category {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  /** Productos visibles en la categoría (solo en findAll) */
  product_count?: number;
}
