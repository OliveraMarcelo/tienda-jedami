import { Request, Response } from 'express';
import { pool } from '../../config/database.js';
import { FIND_CONFIG } from './queries/find-config.js';

export async function getConfig(_req: Request, res: Response) {
  const result = await pool.query(FIND_CONFIG);
  const row = result.rows[0];
  res.status(200).json({
    data: {
      roles: row.roles ?? [],
      priceModes: row.price_modes ?? [],
      purchaseTypes: row.purchase_types ?? [],
      customerTypes: row.customer_types ?? [],
    },
  });
}
