import { describe, it, expect } from 'vitest';
import { buildOrderPaidEmail } from '../modules/notifications/order-paid.js';

describe('buildOrderPaidEmail', () => {
  const order = { id: 17, total_amount: '7500.00', store_name: 'Jedami', whatsapp_number: '11 3432-3271' };
  const items = [
    { quantity: 1, unit_price: '7500.00', product_name: 'Conjunto <Sol>', size: '6M', color: 'Celeste' },
  ];

  it('incluye pedido, total, artículos y links', () => {
    const email = buildOrderPaidEmail(order, items);
    expect(email.subject).toBe('¡Recibimos tu pago! Pedido #17 — Jedami');
    expect(email.text).toContain('pedido #17 por $7.500');
    expect(email.text).toContain('1 × Conjunto <Sol> (6M · Celeste): $7.500');
    expect(email.html).toContain('https://wa.me/1134323271');
    expect(email.html).toContain('/pedidos/17');
  });

  it('escapa el HTML de los nombres de producto', () => {
    const email = buildOrderPaidEmail(order, items);
    expect(email.html).toContain('Conjunto &lt;Sol&gt;');
    expect(email.html).not.toContain('Conjunto <Sol>');
  });

  it('omite WhatsApp si la tienda no tiene número', () => {
    const email = buildOrderPaidEmail({ ...order, whatsapp_number: null }, items);
    expect(email.html).not.toContain('wa.me');
  });
});
