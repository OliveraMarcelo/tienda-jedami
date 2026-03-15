import { PurchaseType } from '../../lib/constants.js';

export type WholesalePurchaseType = Exclude<PurchaseType, 'retail'>;

export interface Order {
  id: number;
  customer_id: number;
  purchase_type: PurchaseType;
  status: 'pending' | 'paid' | 'rejected';
  total_amount: string;
  created_at: Date;
}

export interface OrderItem {
  id: number;
  order_id: number;
  variant_id: number | null;
  product_id: number | null;
  quantity: number;
  unit_price: string;
}
