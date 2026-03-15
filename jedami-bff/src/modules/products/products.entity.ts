export interface Product {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
}

export interface Variant {
  id: number;
  product_id: number;
  size_id: number;
  color_id: number;
}

export interface Size {
  id: number;
  label: string;
  sort_order: number;
}

export interface Color {
  id: number;
  name: string;
  hex_code: string | null;
}

export interface PriceMode {
  id: number;
  code: string;
  label: string;
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
