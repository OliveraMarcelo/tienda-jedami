# Epic 11: Pago Presencial con Mercado Pago Point

**Estado:** backlog
**Depende de:** Epic 3 (done), Epic 10 (done)

---

## Contexto del sistema actual

| Integración | Estado | Epic |
|---|---|---|
| Checkout Pro (redirección a MP) | ✅ done | Epic 3 |
| Checkout API (CardPaymentBrick embebido) | ✅ done | Epic 10 |
| **MP Point (dispositivo físico POS)** | 🔲 backlog | **Epic 11** |

La tabla `payments` actual no distingue por qué canal se pagó. Se agrega `payment_method` como primer paso.

**Diferencia crítica con los flujos online:**
- Checkout Pro/API: el pago ocurre online, el webhook de MP confirma automáticamente.
- Point: el pago ocurre en el dispositivo físico. El sistema envía una "intención de cobro" al device vía API, el cliente toca la tarjeta/celular, y MP notifica el resultado por webhook. Si el webhook no llega, el admin puede confirmar manualmente.

---

## Modelo de datos

### Migration 027 — `payment_method` en `payments`
```sql
ALTER TABLE payments
  ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'checkout'
  CHECK (payment_method IN ('checkout_pro', 'checkout_api', 'point'));

-- Normalizar registros existentes según gateway del momento
UPDATE payments SET payment_method = 'checkout_pro';
```

### Migration 028 — configuración del dispositivo Point
```sql
-- El dispositivo Point se asocia a la tienda (una sola por ahora)
ALTER TABLE branding
  ADD COLUMN point_device_id VARCHAR(100) DEFAULT NULL;
  -- El admin guarda el device_id del dispositivo registrado en su cuenta MP
```

### Comportamiento del stock por tipo de pedido

| Tipo de pedido | Stock descontado en | Efecto del pago Point confirmado |
|---|---|---|
| **retail** | `createRetailOrder` (al crear) | Solo `order.status = 'paid'` |
| **cantidad** | `addCantidadItems` (al agregar ítems) | Solo `order.status = 'paid'` |
| **curva** | Admin fulfillment (al despachar) | Solo `order.status = 'paid'` — el despacho ocurre después |

**La confirmación de pago Point (webhook o manual) nunca toca el stock directamente.**
Para retail y cantidad el stock ya fue descontado al crear el pedido.
Para curva el stock se descuenta en el flujo de despacho (AdminFulfillmentView, Epic 11 story anterior).

---

## Stories

---

### Story 11-1: Modelo de datos y registro de método de pago

**Como** desarrollador,
**quiero** agregar `payment_method` a la tabla `payments` y `point_device_id` a `branding`,
**para** poder distinguir por qué canal se realizó cada pago y configurar el dispositivo Point.

**Criterios de aceptación:**

- **Given** la migración aplicada,
  **When** se crea un pago por Checkout Pro,
  **Then** `payments.payment_method = 'checkout_pro'`.

- **Given** la migración aplicada,
  **When** se crea un pago por Checkout API,
  **Then** `payments.payment_method = 'checkout_api'`.

- **Given** el admin ingresa un `device_id` en configuración,
  **When** se guarda,
  **Then** `branding.point_device_id` se actualiza.

**Tareas técnicas:**
- [ ] Migración SQL `027_payment_method.sql`
- [ ] Migración SQL `028_point_device_id.sql`
- [ ] Actualizar `payments.service.ts`: pasar `payment_method` al crear/actualizar pagos
- [ ] Endpoint `PATCH /admin/config/point-device` para guardar el `device_id`
- [ ] Actualizar `GET /config` para devolver `pointDeviceId`

---

### Story 11-2: Iniciar cobro en dispositivo Point

**Como** admin,
**quiero** enviar una orden de cobro al dispositivo Point físico desde el panel,
**para** que el cliente pueda pagar con tarjeta/celular en el local.

**Flujo:**
```
Admin panel → POST /admin/orders/:orderId/point/initiate
  → Verifica que el pedido esté en status 'pending'
  → Llama a MP API: POST /point/integration-api/devices/{deviceId}/payment-intents
      body: { amount, description, additional_info: { external_reference: orderId } }
  → Guarda en payments: { order_id, payment_method: 'point', status: 'pending', mp_payment_intent_id }
  → Devuelve { paymentIntentId, status: 'pending' }
```

**Criterios de aceptación:**

- **Given** un pedido `pending` con `total_amount > 0`,
  **When** el admin llama a `POST /admin/orders/:orderId/point/initiate`,
  **Then** el dispositivo muestra el monto a cobrar y el sistema devuelve `{ paymentIntentId }`.

- **Given** no hay `point_device_id` configurado,
  **When** se llama al endpoint,
  **Then** error 422 "Dispositivo Point no configurado".

- **Given** el pedido ya está `paid`,
  **When** se intenta iniciar,
  **Then** error 409 "Pedido ya pagado".

- **Given** la API de MP falla (timeout, device offline),
  **When** se llama al endpoint,
  **Then** error 502 con mensaje claro; el pedido queda `pending` sin modificar.

**Tareas técnicas:**
- [ ] Agregar `mp_payment_intent_id VARCHAR(100)` a tabla `payments` (migration 029)
- [ ] Implementar `initiatePointPayment(orderId, adminUserId)` en `payments.service.ts`
- [ ] Usar `MercadoPagoConfig` + `fetch` a `/point/integration-api/devices/{deviceId}/payment-intents`
  (el SDK de MP no tiene cliente nativo para Point API — usar `fetch` directo con `Authorization: Bearer ACCESS_TOKEN`)
- [ ] Endpoint `POST /admin/orders/:orderId/point/initiate` en `admin.routes.ts`
- [ ] Manejo de errores: device offline, monto inválido, device ocupado

---

### Story 11-3: Webhook automático de MP Point

**Como** sistema,
**quiero** recibir la notificación de MP cuando el pago Point sea aprobado o rechazado,
**para** actualizar el pedido y descontar stock automáticamente.

**Flujo:**
```
MP Point device → pago procesado
  → MP envía POST /api/v1/payments/webhook (mismo endpoint que Checkout)
  → El handler detecta que el payment tiene mp_payment_id asociado a un intent de Point
  → Si approved: order.status = 'paid', payments.status = 'approved', payments.paid_at = NOW()
      - retail/cantidad: stock ya descontado al crear el pedido, nada más que hacer
      - curva: stock se descuenta en el despacho (flujo de fulfillment, posterior)
  → Si rejected: payments.status = 'rejected', order sigue 'pending'
  → Idempotencia: si mp_payment_id ya procesado → 200 sin re-procesar
```

**Criterios de aceptación:**

- **Given** un pedido retail o cantidad con pago Point aprobado,
  **When** llega el webhook,
  **Then** `orders.status = 'paid'`, `payments.status = 'approved'` — el stock ya fue descontado al crear el pedido.

- **Given** un pedido curva con pago Point aprobado,
  **When** llega el webhook,
  **Then** `orders.status = 'paid'`, `payments.status = 'approved'` — el stock se descuenta después en el despacho.

- **Given** el mismo webhook llega dos veces (retry de MP),
  **When** se procesa el segundo,
  **Then** responde 200 sin duplicar operaciones (idempotencia).

- **Given** pago rechazado,
  **When** llega el webhook,
  **Then** `payments.status = 'rejected'`, pedido queda `pending`.

**Tareas técnicas:**
- [ ] El webhook handler existente (`handleWebhook` en `payments.service.ts`) debe funcionar igual para Point — verificar que `external_reference` mapea al `orderId` correctamente
- [ ] Agregar lógica para vincular `mp_payment_id` con el `mp_payment_intent_id` guardado
- [ ] Tests de integración para el escenario Point

---

### Story 11-4: Confirmación manual de pago Point (fallback)

**Como** admin,
**quiero** poder confirmar manualmente un pago Point cuando el webhook no llegó,
**para** no dejar al cliente esperando mientras se resuelve la notificación automática.

**Flujo:**
```
Admin panel → PATCH /admin/orders/:orderId/point/confirm
  body: { mpPaymentId?: string }  // opcional: el ID que aparece en la app MP del vendedor
  → Verifica pedido pending
  → Si mpPaymentId se provee: busca en MP API y verifica que esté approved
  → Si no se provee: confirmación ciega (confianza en el admin)
  → Transacción: order.status = 'paid', inserta/actualiza payments
      - retail/cantidad: stock ya descontado, no se toca
      - curva: stock se descuenta en el despacho posterior, no se toca aquí
```

**Criterios de aceptación:**

- **Given** pedido `pending` con pago realizado en el dispositivo pero sin webhook,
  **When** admin confirma con `mpPaymentId` válido,
  **Then** sistema verifica contra MP API, actualiza status y descuenta stock.

- **Given** admin confirma sin `mpPaymentId` (modo confianza),
  **When** se llama al endpoint,
  **Then** pedido pasa a `paid` y stock se descuenta.

- **Given** `mpPaymentId` provisto pero en MP está `rejected` o no existe,
  **When** admin intenta confirmar,
  **Then** error 422 "El pago no está aprobado en Mercado Pago".

- **Given** pedido ya `paid`,
  **When** se llama al endpoint,
  **Then** error 409 "Pedido ya pagado".

**Tareas técnicas:**
- [ ] Implementar `confirmPointPaymentManual(orderId, mpPaymentId?)` en `payments.service.ts`
- [ ] Reutilizar la lógica de descuento de stock del webhook handler (extraer a función compartida)
- [ ] Endpoint `PATCH /admin/orders/:orderId/point/confirm` en `admin.routes.ts`
- [ ] Si se provee `mpPaymentId`: llamar a `GET /v1/payments/{id}` en MP API y verificar `status === 'approved'`

---

## Story WEB derivada

### Story web-11-1: UI Admin — Panel de pagos Point

**Como** admin,
**quiero** iniciar cobros Point y confirmar pagos manualmente desde el panel web,
**para** gestionar el flujo presencial sin salir del sistema.

**Pantallas / componentes:**

1. **`AdminPointView.vue`** — lista pedidos `pending` que pueden cobrarse por Point + botón "Cobrar con Point"
2. **Al hacer clic en "Cobrar"** → llama a `POST /admin/orders/:orderId/point/initiate` → muestra estado "Esperando pago en dispositivo…"
3. **Polling o refresh manual** para ver si llegó el webhook (cambio a `paid`)
4. **Botón "Confirmar manualmente"** → modal donde puede ingresar el `mp_payment_id` opcional → llama a `PATCH /admin/orders/:orderId/point/confirm`
5. **Configuración** → en `AdminConfigView` pestaña "Pagos": campo para guardar el `point_device_id`

**Depende de:** stories 11-1, 11-2, 11-3, 11-4 (BFF done)

---

## Eventos del sistema (para logs / futura auditoría)

| Evento | Trigger |
|--------|---------|
| `payment.point.initiated` | Admin inicia cobro en device |
| `payment.point.approved_webhook` | Webhook automático de MP |
| `payment.point.confirmed_manual` | Admin confirma sin webhook |
| `payment.point.rejected` | Webhook de rechazo o error en device |
| `stock.deducted` | Después de cualquier confirmación de pago |

---

## Consideraciones especiales

### Point NO tiene sandbox real
- Para desarrollo: usar `payment_method: 'point'` en los endpoints pero simular el webhook manualmente con `POST /payments/webhook` con body de prueba.
- Los tests de integración para Point usan confirmación manual (story 11-4).
- En producción: registrar el `device_id` real del dispositivo comprado.

### Estados inconsistentes
- Pedido `pending` con pago intent enviado al device pero sin respuesta → el admin usa confirmación manual.
- Pedido marcado como `paid` dos veces → idempotencia en webhook + validación `order.status !== 'paid'` antes de procesar.
- Device offline al enviar intent → error 502, pedido no se modifica, el admin puede reintentar.

### Comportamiento del stock por tipo de pedido (resumen)
- **Retail**: stock descontado al crear el pedido → confirmar pago solo cambia status.
- **Cantidad**: stock descontado al agregar ítems → confirmar pago solo cambia status.
- **Curva**: sin stock descontado hasta el despacho → confirmar pago solo cambia status → admin asigna color y descuenta stock después en AdminFulfillmentView.

En ninguno de los tres casos el webhook ni la confirmación manual tocan el stock.

### Cancelación durante pago Point en progreso
- Si el intent fue enviado al device pero el cliente no pagó aún, el admin puede cancelar el pedido normalmente (`POST /orders/:id/cancel`).
- Para retail y cantidad: el cancel ya restaura el stock (lógica existente).
- Para curva: cancel no toca stock (ya que nunca fue descontado).
