import { pool } from '../../config/database.js';
import { AppError } from '../../types/app-error.js';

export interface Customer {
  id: number;
  user_id: number;
  customer_type: 'retail' | 'wholesale';
}

export const createCustomer = async (userId: number): Promise<Customer> => {
  const result = await pool.query(
    'INSERT INTO customers (user_id, customer_type) VALUES ($1, $2) RETURNING id, user_id, customer_type',
    [userId, 'retail'],
  );
  return result.rows[0];
};

export const findByUserId = async (userId: number): Promise<Customer | null> => {
  const result = await pool.query(
    'SELECT id, user_id, customer_type FROM customers WHERE user_id = $1',
    [userId],
  );
  return result.rows[0] ?? null;
};

export const updateCustomerType = async (userId: number, customerType: 'retail' | 'wholesale'): Promise<void> => {
  const result = await pool.query(
    'UPDATE customers SET customer_type = $1 WHERE user_id = $2',
    [customerType, userId],
  );
  if (result.rowCount === 0) {
    throw new AppError(404, 'Perfil de comprador no encontrado', 'https://jedami.com/errors/not-found', `El usuario ${userId} no tiene perfil de comprador`);
  }
};
