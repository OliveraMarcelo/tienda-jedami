import { Request, Response } from 'express';
import { pool } from '../../config/database.js';
import { cacheGet, cacheSet } from '../../config/redis.js';
import { DASHBOARD_QUERY, RECENT_ORDERS_QUERY } from './queries/dashboard.js';

const DASHBOARD_CACHE_KEY = 'admin:dashboard';
const DASHBOARD_TTL = 60; // segundos

export async function getDashboard(_req: Request, res: Response) {
  // Intentar desde caché
  const cached = await cacheGet(DASHBOARD_CACHE_KEY);
  if (cached) {
    return res.status(200).json({ data: JSON.parse(cached) });
  }

  const [statsResult, recentResult] = await Promise.all([
    pool.query(DASHBOARD_QUERY),
    pool.query(RECENT_ORDERS_QUERY),
  ]);

  const row = statsResult.rows[0];

  const data = {
    totalOrders: Number(row.total_orders),
    totalRevenue: Number(row.total_revenue),
    revenueLast30d: Number(row.revenue_last_30d),
    ordersByStatus: {
      pending:  Number(row.pending_orders),
      paid:     Number(row.paid_orders),
      rejected: Number(row.rejected_orders),
    },
    ordersByType: {
      retail:   Number(row.retail_orders),
      curva:    Number(row.curva_orders),
      cantidad: Number(row.cantidad_orders),
    },
    recentOrders: recentResult.rows.map(r => ({
      id:            r.id,
      purchaseType:  r.purchase_type,
      status:        r.status,
      totalAmount:   Number(r.total_amount),
      createdAt:     r.created_at,
      customerEmail: r.customer_email,
    })),
  };

  await cacheSet(DASHBOARD_CACHE_KEY, JSON.stringify(data), DASHBOARD_TTL);

  return res.status(200).json({ data });
}
