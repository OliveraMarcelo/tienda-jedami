import { pool } from '../../config/database.js';
import { Order, OrderItem } from './orders.entity.js';
import { CREATE_ORDER } from './queries/create-order.js';
import { FIND_ORDERS_BY_CUSTOMER } from './queries/find-orders-by-customer.js';
import { FIND_ORDER_BY_ID, FIND_ORDER_ITEMS } from './queries/find-order-by-id.js';

export const create = async (customerId: number, purchaseType: 'curva' | 'cantidad'): Promise<Order> => {
  const result = await pool.query(CREATE_ORDER, [customerId, purchaseType]);
  return result.rows[0];
};

export const findByCustomerId = async (customerId: number): Promise<Order[]> => {
  const result = await pool.query(FIND_ORDERS_BY_CUSTOMER, [customerId]);
  return result.rows;
};

export const findById = async (id: number): Promise<Order | null> => {
  const result = await pool.query(FIND_ORDER_BY_ID, [id]);
  return result.rows[0] ?? null;
};

export const findItemsByOrderId = async (orderId: number): Promise<(OrderItem & { variant_size?: string; variant_color?: string })[]> => {
  const result = await pool.query(FIND_ORDER_ITEMS, [orderId]);
  return result.rows;
};
