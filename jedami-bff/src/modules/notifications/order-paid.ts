import { pool } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { isMailerConfigured, sendMail } from '../../lib/mailer.js';

const ORDER_PAID_QUERY = `
  SELECT o.id, o.total_amount, u.email,
         (SELECT store_name FROM branding WHERE id = 1)      AS store_name,
         (SELECT whatsapp_number FROM branding WHERE id = 1) AS whatsapp_number
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN users u     ON u.id = c.user_id
  WHERE o.id = $1
`;

const ORDER_PAID_ITEMS_QUERY = `
  SELECT oi.quantity, oi.unit_price,
         p.name                           AS product_name,
         COALESCE(sz_v.label, sz_i.label) AS size,
         cl.name                          AS color
  FROM order_items oi
  LEFT JOIN variants v ON v.id = oi.variant_id
  LEFT JOIN products p ON p.id = COALESCE(v.product_id, oi.product_id)
  LEFT JOIN sizes sz_v ON sz_v.id = v.size_id
  LEFT JOIN sizes sz_i ON sz_i.id = oi.size_id
  LEFT JOIN colors cl  ON cl.id = v.color_id
  WHERE oi.order_id = $1
  ORDER BY oi.id
`;

const money = (n: number | string) => `$${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface ItemRow { quantity: number; unit_price: string; product_name: string | null; size: string | null; color: string | null }

/** Arma el email de "pago confirmado". Exportado para tests. */
export function buildOrderPaidEmail(order: { id: number; total_amount: string; store_name: string; whatsapp_number: string | null }, items: ItemRow[]) {
  const store = order.store_name || 'la tienda';
  const orderUrl = `${ENV.FRONTEND_URL}/pedidos/${order.id}`;
  const lines = items.map(i => {
    const detail = [i.size, i.color].filter(Boolean).join(' · ');
    const name = i.product_name ?? 'Artículo';
    return { label: detail ? `${name} (${detail})` : name, qty: i.quantity, subtotal: i.quantity * Number(i.unit_price) };
  });
  const digits = (order.whatsapp_number ?? '').replace(/\D/g, '');
  const waUrl = digits ? `https://wa.me/${digits}` : null;

  const subject = `¡Recibimos tu pago! Pedido #${order.id} — ${store}`;

  const text = [
    `¡Gracias por tu compra!`,
    ``,
    `Confirmamos el pago de tu pedido #${order.id} por ${money(order.total_amount)}.`,
    ``,
    ...lines.map(l => `- ${l.qty} × ${l.label}: ${money(l.subtotal)}`),
    ``,
    `Te vamos a escribir para coordinar el envío.`,
    `Ver pedido: ${orderUrl}`,
    waUrl ? `WhatsApp: ${waUrl}` : '',
    ``,
    store,
  ].join('\n');

  const rows = lines.map(l => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #E5E2DD">${l.qty} × ${escapeHtml(l.label)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #E5E2DD;text-align:right;white-space:nowrap">${money(l.subtotal)}</td>
      </tr>`).join('');

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#F3F1EE;font-family:Arial,Helvetica,sans-serif;color:#33363A">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#ffffff;border-radius:20px;padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#6B6F72">${escapeHtml(store)}</p>
      <h1 style="margin:0 0 12px;font-size:24px">¡Recibimos tu pago!</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5">
        Confirmamos el pago de tu pedido <strong>#${order.id}</strong>. Te vamos a escribir para coordinar el envío.
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${rows}
        <tr>
          <td style="padding:12px 0 0;font-weight:bold">Total pagado</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:bold;color:#23795A;font-size:18px">${money(order.total_amount)}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0">
        <a href="${orderUrl}" style="display:inline-block;background:#33363A;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold">Ver mi pedido</a>
      </p>
      ${waUrl ? `<p style="margin:16px 0 0;font-size:14px">¿Dudas? <a href="${waUrl}" style="color:#23795A">Escribinos por WhatsApp</a></p>` : ''}
    </div>
  </div>
</body></html>`;

  return { subject, text, html };
}

/**
 * Avisa al cliente por email que su pago se confirmó.
 * Fire-and-forget: nunca lanza ni demora la respuesta; llamarlo solo cuando el
 * pedido acaba de pasar a "paid" (para no repetir el aviso).
 */
export function notifyOrderPaid(orderId: number): void {
  if (!isMailerConfigured()) return;
  void (async () => {
    try {
      const orderRes = await pool.query(ORDER_PAID_QUERY, [orderId]);
      const order = orderRes.rows[0];
      if (!order?.email) return;
      const itemsRes = await pool.query(ORDER_PAID_ITEMS_QUERY, [orderId]);
      const email = buildOrderPaidEmail(order, itemsRes.rows);
      await sendMail({ to: order.email, ...email });
    } catch (err) {
      logger.error({ err, orderId }, '[MAIL] Error preparando el aviso de pago');
    }
  })();
}
