export interface Product {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
}

export interface Variant {
  id: number;
  product_id: number;
  size: string;
  color: string;
  retail_price: string;
  wholesale_price: string | null;
}

export interface Stock {
  variant_id: number;
  quantity: number;
}

export interface ProductImage {
  id: number;
  product_id: number;
  url: string;
  position: number;
  created_at: string;
}
