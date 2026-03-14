export interface Product {
  id: number;
  name: string;
  description: string | null;
}

export interface Variant {
  id: number;
  product_id: number;
  size: string;
  color: string;
  retail_price: number;
}

export interface Stock {
  variant_id: number;
  quantity: number;
}
