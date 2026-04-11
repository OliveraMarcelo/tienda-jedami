import { afterEach, afterAll } from 'vitest';
import { pool } from '../../config/database.js';

afterEach(async () => {
  await pool.query(
    'TRUNCATE users, customers, orders, order_items, payments, quantity_discount_rules, curva_discount_rules RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await pool.end();
});
