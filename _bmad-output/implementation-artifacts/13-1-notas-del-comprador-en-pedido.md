# Story 13-1: Notas del comprador en el pedido

**Épica:** 13 — Mejoras de experiencia del comprador
**Track:** BFF (jedami-bff)
**Estado:** backlog
**Aplica a:** retail, cantidad, curva (todos los tipos de pedido)

---

## Contexto

El comprador (mayorista o minorista) necesita poder dejar una nota o comentario libre al hacer su pedido, para que el administrador la lea y la tenga en cuenta al preparar o despachar el pedido.

Ejemplos de uso:
- "Entregar en horario de la tarde"
- "Necesito factura A a nombre de Empresa SRL"
- "El color preferido es azul, si no hay negro"
- "Es para regalo, por favor empaquetar"
- "Llamar antes de enviar al +54 11 1234-5678"

---

## Modelo de datos

```sql
-- Migration 027_order_notes.sql
ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT NULL;
```

Un campo de texto libre, sin restricciones de formato. `NULL` si el comprador no dejó nota.

---

## Reglas de negocio

- La nota es opcional en todos los tipos de pedido.
- El comprador puede escribirla al crear el pedido o editarla mientras el pedido está en estado `pending`.
- Una vez que el pedido está `paid` o `cancelled`, la nota es de solo lectura.
- El admin puede ver la nota pero no editarla (es la voz del comprador).
- Sin límite de caracteres impuesto en la API — el frontend limita a 500 caracteres para UX.

---

## API

### Al crear el pedido mayorista

`POST /api/v1/orders`
```json
{
  "purchaseType": "curva",
  "notes": "Entregar en horario de la tarde"
}
```

### Al crear el pedido minorista

`POST /api/v1/orders/retail`
```json
{
  "items": [...],
  "notes": "Necesito factura A"
}
```

### Editar la nota (mientras está pending)

`PATCH /api/v1/orders/:orderId/notes`
```json
{ "notes": "Texto actualizado" }
```
→ Error 422 si el pedido no está en estado `pending`.

### La nota se devuelve en el detalle del pedido

`GET /api/v1/orders/:orderId`
```json
{
  "id": 10,
  "purchaseType": "curva",
  "status": "pending",
  "totalAmount": 6250,
  "notes": "Entregar en horario de la tarde",
  "items": [...]
}
```

### El admin la ve en los endpoints de admin

`GET /api/v1/admin/orders/pending-fulfillment` → incluir `notes` por pedido.
`GET /api/v1/admin/payments` → incluir `notes` en la respuesta de pagos/pedidos.

---

## Tareas técnicas BFF

- [ ] Migration `027_order_notes.sql` — `ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT NULL`
- [ ] Actualizar `ordersRepository.create()` para aceptar `notes` opcional
- [ ] Actualizar `createRetailOrder()` en `orders.service.ts` para recibir y guardar `notes`
- [ ] Actualizar `createOrder()` (mayorista) para recibir y guardar `notes`
- [ ] Nuevo endpoint `PATCH /api/v1/orders/:orderId/notes` con validación de estado `pending`
- [ ] Actualizar `FIND_ORDER_BY_ID` query para incluir `notes` en la respuesta
- [ ] Actualizar `PENDING_FULFILLMENT_QUERY` para incluir `notes` por pedido
- [ ] Actualizar `ADMIN_PAYMENTS_QUERY` para incluir `notes` del pedido asociado

---

## Story WEB derivada

**Story web-13-1** — depende de 13-1 BFF done.

### En el checkout (OrdersView.vue)
- Agregar `<textarea>` opcional antes del botón de pago: "Notas para el administrador (opcional)"
- Máximo 500 caracteres con contador visible
- Se envía junto con la creación del pedido o via `PATCH /orders/:id/notes` antes de pagar

### En el detalle del pedido (OrderDetailView.vue)
- Mostrar la nota si existe, bajo los ítems
- Si el pedido está `pending`: mostrar campo editable con botón "Guardar nota"
- Si el pedido está `paid` o `cancelled`: mostrar la nota en modo solo lectura

### En el panel admin
- **AdminFulfillmentView.vue**: mostrar la nota del pedido en la cabecera de cada orden
- **AdminPaymentsView.vue**: mostrar ícono/tooltip con la nota si existe
