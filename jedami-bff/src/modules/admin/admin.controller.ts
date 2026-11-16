import { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database.js';
import { cacheGet, cacheSet } from '../../config/redis.js';
import { AppError } from '../../types/app-error.js';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import { DASHBOARD_QUERY, RECENT_ORDERS_QUERY } from './queries/dashboard.js';
import { ADMIN_PAYMENTS_QUERY, ADMIN_PAYMENTS_COUNT_QUERY } from './queries/payments.js';
import { ADMIN_USERS_QUERY, ADMIN_USERS_COUNT_QUERY } from './queries/users.js';
import { REPORTS_QUERY } from './queries/reports.js';
import { notifyOrderPaid } from '../notifications/order-paid.js';

const DASHBOARD_CACHE_KEY = 'admin:dashboard';
const REPORTS_CACHE_KEY = (limit: number) => `admin:reports:${limit}`;
const REPORTS_TTL = 300;
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
      shipped:  Number(row.shipped_orders),
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

export async function getAdminPayments(req: Request, res: Response) {
  const page   = Math.max(1, Number(req.query.page)   || 1);
  const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const status    = (req.query.status    as string) || null;
  const dateFrom  = (req.query.date_from as string) || null;
  const dateTo    = (req.query.date_to   as string) || null;

  const [dataResult, countResult] = await Promise.all([
    pool.query(ADMIN_PAYMENTS_QUERY,       [limit, offset, status, dateFrom, dateTo]),
    pool.query(ADMIN_PAYMENTS_COUNT_QUERY, [status, dateFrom, dateTo]),
  ]);

  const total = Number(countResult.rows[0].total);

  return res.status(200).json({
    data: {
      payments: dataResult.rows.map(r => ({
        id:            r.id ?? null,
        orderId:       r.order_id,
        paymentStatus:  r.payment_status,
        // null = el pedido todavía no inició un pago
        paymentMethod:  r.id ? (r.payment_method ?? 'mercadopago') : null,
        methods:        (r.methods ?? []) as string[],
        mpPaymentId:    r.mp_payment_id ?? null,
        paidAt:        r.paid_at,
        createdAt:     r.created_at,
        purchaseType:  r.purchase_type,
        orderStatus:   r.order_status,
        totalAmount:   Number(r.total_amount),
        notes:         r.notes ?? null,
        customerEmail: r.customer_email,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

// ─── Confirmar transferencia bancaria ────────────────────────────────────────

export async function confirmBankTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId) || orderId <= 0) {
    next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del pedido debe ser un entero positivo'));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `SELECT id FROM payments
       WHERE order_id = $1 AND payment_method = 'bank_transfer' AND status = 'pending'`,
      [orderId],
    );
    if (paymentRes.rowCount === 0) {
      throw new AppError(404, 'Pago no encontrado', 'https://jedami.com/errors/not-found',
        'No hay pago pendiente de transferencia para este pedido');
    }

    await client.query(
      `UPDATE payments SET status = 'approved', paid_at = NOW() WHERE id = $1`,
      [paymentRes.rows[0].id],
    );
    const upd = await client.query(
      `UPDATE orders SET status = 'paid' WHERE id = $1 AND status != 'paid'`,
      [orderId],
    );

    await client.query('COMMIT');
    if (upd.rowCount) notifyOrderPaid(orderId);
    res.status(200).json({ data: { orderId, status: 'paid' } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function getAdminUsers(req: Request, res: Response) {
  const page   = Math.max(1, Number(req.query.page)   || 1);
  const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const role   = (req.query.role   as string) || null;
  const search = (req.query.search as string) || null;

  const [dataResult, countResult] = await Promise.all([
    pool.query(ADMIN_USERS_QUERY,       [limit, offset, role, search]),
    pool.query(ADMIN_USERS_COUNT_QUERY, [role, search]),
  ]);

  const total = Number(countResult.rows[0].total);

  return res.status(200).json({
    data: {
      users: dataResult.rows.map(r => ({
        id:           r.id,
        email:        r.email,
        createdAt:    r.created_at,
        roles:        r.roles ?? [],
        customerId:   r.customer_id   ?? null,
        customerType: r.customer_type ?? null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

// ─── Reportes ────────────────────────────────────────────────────────────────

export async function getAdminReports(req: Request, res: Response) {
  const rawLimit = Number(req.query.limit) || 10;
  const limit = Math.min(50, Math.max(1, rawLimit));

  const cached = await cacheGet(REPORTS_CACHE_KEY(limit));
  if (cached) {
    return res.status(200).json({ data: JSON.parse(cached) });
  }

  const result = await pool.query(REPORTS_QUERY, [limit]);
  const row = result.rows[0];

  const data = {
    topProducts: (row.top_products as Array<{ product_id: number; name: string; total_units: string; total_revenue: string }>).map(r => ({
      productId:    r.product_id,
      name:         r.name,
      totalUnits:   Number(r.total_units),
      totalRevenue: Number(r.total_revenue),
    })),
    topCustomers: (row.top_customers as Array<{ customer_id: number; email: string; total_orders: string; total_revenue: string }>).map(r => ({
      customerId:   r.customer_id,
      email:        r.email,
      totalOrders:  Number(r.total_orders),
      totalRevenue: Number(r.total_revenue),
    })),
  };

  await cacheSet(REPORTS_CACHE_KEY(limit), JSON.stringify(data), REPORTS_TTL);
  return res.status(200).json({ data });
}

// ─── Stock adjustment ─────────────────────────────────────────────────────────

export async function updateVariantStock(req: Request, res: Response): Promise<void> {
  const productId = parseInt(req.params.productId, 10);
  const variantId = parseInt(req.params.variantId, 10);
  const quantity  = parseInt(req.body.quantity,   10);
  const user      = req.user as JwtUserPayload;

  if (isNaN(productId) || isNaN(variantId)) throw new AppError(400, 'IDs inválidos', 'https://jedami.com/errors/validation', 'productId y variantId deben ser enteros positivos');
  if (isNaN(quantity) || quantity < 0)      throw new AppError(400, 'quantity inválido', 'https://jedami.com/errors/validation', 'quantity debe ser un entero >= 0');

  // Verificar que la variante pertenece al producto
  const check = await pool.query(
    'SELECT v.id FROM variants v WHERE v.id = $1 AND v.product_id = $2',
    [variantId, productId],
  );
  if (check.rows.length === 0) throw new AppError(404, 'Variante no encontrada', 'https://jedami.com/errors/not-found', 'La variante no existe en este producto');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query(
      'SELECT quantity FROM stock WHERE variant_id = $1',
      [variantId],
    );
    const oldQuantity: number = oldResult.rows[0]?.quantity ?? 0;

    await client.query(
      'UPDATE stock SET quantity = $1 WHERE variant_id = $2',
      [quantity, variantId],
    );
    await client.query(
      'INSERT INTO stock_adjustments (variant_id, user_id, old_quantity, new_quantity) VALUES ($1, $2, $3, $4)',
      [variantId, user.id, oldQuantity, quantity],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(200).json({ data: { variantId, newQuantity: quantity } });
}
