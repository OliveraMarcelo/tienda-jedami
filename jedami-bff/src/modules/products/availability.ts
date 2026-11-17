// Stock disponible = stock físico − lo comprometido en pedidos pagados sin despachar.
//
// Las compras por curva y por cantidad no descuentan stock al pagar: el color (y el talle de las
// unidades que sobran) lo elige el admin al despachar. Mientras tanto, esas unidades quedan
// reservadas por talle (o por producto, las que no tienen talle) y la tienda no las vuelve a vender.
import type { PoolClient } from 'pg';
import { AppError } from '../../types/app-error.js';

type Db = Pick<PoolClient, 'query'>;

export interface ProductStock {
  /** Stock físico por talle (variantes activas, todos los colores) */
  stockBySize: Map<number, number>;
  /** Unidades reservadas por talle */
  reservedBySize: Map<number, number>;
  /** Stock físico total del producto */
  total: number;
  /** Reservado total, incluidas las unidades sin talle asignado */
  reservedTotal: number;
}

const STOCK_QUERY = `
  SELECT v.product_id, v.size_id, SUM(COALESCE(s.quantity, 0))::int AS stock
  FROM variants v
  LEFT JOIN stock s ON s.variant_id = v.id
  WHERE v.product_id = ANY($1) AND v.active = TRUE
  GROUP BY v.product_id, v.size_id
`;

// Líneas de pedidos pagados que todavía no descontaron stock (curva y cantidad).
// $2 = pedido a excluir (el que se está por pagar no se reserva a sí mismo)
const RESERVED_QUERY = `
  SELECT oi.product_id, oi.size_id, SUM(oi.quantity)::int AS reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status = 'paid'
    AND oi.stock_deducted = FALSE
    AND oi.variant_id IS NULL
    AND oi.product_id = ANY($1)
    AND ($2::INT IS NULL OR o.id <> $2)
  GROUP BY oi.product_id, oi.size_id
`;

function emptyStock(): ProductStock {
  return { stockBySize: new Map(), reservedBySize: new Map(), total: 0, reservedTotal: 0 };
}

export async function loadStock(db: Db, productIds: number[], excludeOrderId: number | null = null): Promise<Map<number, ProductStock>> {
  const ids = [...new Set(productIds)];
  const out = new Map<number, ProductStock>(ids.map(id => [id, emptyStock()]));
  if (ids.length === 0) return out;
  const [stock, reserved] = await Promise.all([
    db.query(STOCK_QUERY, [ids]),
    db.query(RESERVED_QUERY, [ids, excludeOrderId]),
  ]);
  for (const r of stock.rows as { product_id: number; size_id: number; stock: number }[]) {
    const p = out.get(r.product_id)!;
    p.stockBySize.set(r.size_id, r.stock);
    p.total += r.stock;
  }
  for (const r of reserved.rows as { product_id: number; size_id: number | null; reserved: number }[]) {
    const p = out.get(r.product_id)!;
    if (r.size_id != null) p.reservedBySize.set(r.size_id, (p.reservedBySize.get(r.size_id) ?? 0) + r.reserved);
    p.reservedTotal += r.reserved;
  }
  return out;
}

const units = (n: number) => `${n} ${n === 1 ? 'unidad disponible' : 'unidades disponibles'}`;

/** Unidades de un talle que se pueden vender sin tocar lo reservado */
export function sizeAvailable(p: ProductStock, sizeId: number): number {
  return (p.stockBySize.get(sizeId) ?? 0) - (p.reservedBySize.get(sizeId) ?? 0);
}

/** Unidades del producto que se pueden vender sin tocar lo reservado */
export function productAvailable(p: ProductStock): number {
  return p.total - p.reservedTotal;
}

/** Lo que se puede vender de una variante: su stock, sin pasarse de lo libre del talle y del producto */
export function variantAvailable(p: ProductStock | undefined, sizeId: number, physical: number): number {
  if (!p) return Math.max(0, physical);
  return Math.max(0, Math.min(physical, sizeAvailable(p, sizeId), productAvailable(p)));
}

/**
 * ¿Alcanza para vender estas unidades sin tocar lo reservado?
 * `bySize`: unidades por talle; `withoutSize`: unidades sin talle (las que sobran de una compra por cantidad).
 * Devuelve el primer faltante, o null si alcanza.
 */
export function shortage(
  p: ProductStock,
  bySize: Map<number, number>,
  withoutSize = 0,
  sizeLabel: (id: number) => string = id => String(id),
): string | null {
  let wanted = withoutSize;
  for (const [sizeId, qty] of bySize) {
    wanted += qty;
    const free = Math.max(0, sizeAvailable(p, sizeId));
    if (qty > free) return `Del talle ${sizeLabel(sizeId)} ${free === 1 ? 'queda' : 'quedan'} ${units(free)} y necesitás ${qty}`;
  }
  const free = Math.max(0, productAvailable(p));
  if (wanted > free) return `De este producto ${free === 1 ? 'queda' : 'quedan'} ${units(free)} y necesitás ${wanted}`;
  return null;
}

/** Bloquea los productos para que dos compras simultáneas no se lleven las mismas unidades */
export async function lockProducts(db: Db, productIds: number[]): Promise<void> {
  const ids = [...new Set(productIds)].sort((a, b) => a - b);
  if (ids.length > 0) await db.query('SELECT id FROM products WHERE id = ANY($1) ORDER BY id FOR UPDATE', [ids]);
}

function insufficient(detail: string): AppError {
  return new AppError(422, 'Stock insuficiente', 'https://jedami.com/errors/insufficient-stock', detail);
}

/**
 * Antes de pagar un pedido por curva o por cantidad: sus unidades tienen que seguir disponibles
 * (otro pedido pagado pudo haberse llevado ese stock mientras este esperaba).
 */
export async function assertOrderAvailable(db: Db, orderId: number): Promise<void> {
  const lines = (await db.query(
    `SELECT oi.product_id, oi.size_id, oi.quantity, p.name AS product_name, sz.label AS size_label
     FROM order_items oi
     JOIN products p    ON p.id = oi.product_id
     LEFT JOIN sizes sz ON sz.id = oi.size_id
     WHERE oi.order_id = $1 AND oi.variant_id IS NULL AND oi.stock_deducted = FALSE`,
    [orderId],
  )).rows as { product_id: number; size_id: number | null; quantity: number; product_name: string; size_label: string | null }[];
  if (lines.length === 0) return;

  const stock = await loadStock(db, lines.map(l => l.product_id), orderId);
  const products = new Map<number, { name: string; bySize: Map<number, number>; withoutSize: number; labels: Map<number, string> }>();
  for (const l of lines) {
    const g = products.get(l.product_id) ?? { name: l.product_name, bySize: new Map(), withoutSize: 0, labels: new Map() };
    if (l.size_id == null) g.withoutSize += l.quantity;
    else {
      g.bySize.set(l.size_id, (g.bySize.get(l.size_id) ?? 0) + l.quantity);
      g.labels.set(l.size_id, l.size_label ?? String(l.size_id));
    }
    products.set(l.product_id, g);
  }
  for (const [productId, g] of products) {
    const missing = shortage(stock.get(productId)!, g.bySize, g.withoutSize, id => g.labels.get(id) ?? String(id));
    if (missing) throw insufficient(`${g.name}: ${missing}. Otro pedido ya pagado se llevó esas prendas: cancelá este pedido y armá uno nuevo con lo que hay, o escribinos.`);
  }
}

export { insufficient as insufficientStockError };
