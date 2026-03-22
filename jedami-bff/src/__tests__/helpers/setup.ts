import { afterEach, afterAll } from 'vitest';
import { pool } from '../../config/database.js';

afterEach(async () => {
  await pool.query(
    'TRUNCATE users, customers, orders, order_items, payments RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await pool.end();
});
