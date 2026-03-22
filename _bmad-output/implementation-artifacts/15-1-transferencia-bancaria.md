# Story 15-1: Transferencia Bancaria — BFF

Status: review

## Story

Como administrador,
quiero configurar los datos bancarios de la tienda (CVU, alias, titular, banco, notas)
para que los compradores puedan pagar por transferencia y yo pueda confirmarla manualmente.

Como comprador,
quiero poder iniciar un pago por transferencia bancaria
para recibir los datos de la cuenta y completar el pago desde mi homebanking.

## Acceptance Criteria

1. **Given** el admin accede a `PUT /config/branding`
   **When** envía campos `bankTransferCvu`, `bankTransferAlias`, `bankTransferHolderName`, `bankTransferBankName`, `bankTransferNotes`
   **Then** los datos se guardan en la tabla `branding`

2. **Given** cualquier cliente llama `GET /config/branding`
   **Then** la respuesta incluye los campos de transferencia bancaria

3. **Given** el admin cambia `payment_gateway` a `'bank_transfer'` vía `PUT /config/payment-gateway`
   **Then** el sistema lo acepta (el CHECK constraint lo permite)

4. **Given** el comprador llama `POST /payments/:orderId/checkout` y el gateway activo es `bank_transfer`
   **When** el pedido está en estado `pending`
   **Then** se crea un registro en `payments` con `payment_method = 'bank_transfer'` y `status = 'pending'`
   **And** la respuesta es `{ method: 'bank_transfer', bankDetails: { cvu, alias, holderName, bankName, notes, amount } }`
   **And** si ya existe un pago `pending` para el pedido, se devuelve el existente sin crear uno nuevo

5. **Given** el admin llama `POST /admin/orders/:id/confirm-transfer`
   **When** el pedido tiene un pago `bank_transfer` con status `pending`
   **Then** el pago pasa a `status = 'approved'`, `paid_at = NOW()`
   **And** el pedido pasa a `status = 'paid'`
   **And** la respuesta es `{ data: { orderId, status: 'paid' } }`

6. **Given** el admin llama `POST /admin/orders/:id/confirm-transfer`
   **When** el pedido no tiene pago pendiente de transferencia
   **Then** responde `404` con mensaje descriptivo

7. **Given** el endpoint `GET /admin/payments`
   **Then** la respuesta incluye `paymentMethod` (`'mercadopago'` | `'bank_transfer'`) por registro

## Tasks / Subtasks

- [x] **Migration 035_bank_transfer.sql**
  - Agregar columnas a `branding`: `bank_transfer_cvu`, `bank_transfer_alias`, `bank_transfer_holder_name`, `bank_transfer_bank_name`, `bank_transfer_notes`
  - Actualizar CHECK constraint de `payment_gateway` para incluir `'bank_transfer'`
  - Agregar columna `payment_method VARCHAR(20) NOT NULL DEFAULT 'mercadopago'` a `payments`

- [x] **config.controller.ts** — agregar campos bank_transfer en `getBranding`, `updateBranding`

- [x] **payments.service.ts** — `initiateCheckout`: manejar caso `bank_transfer`
  - Si gateway = `bank_transfer`: buscar/crear payment record, retornar bank details del branding
  - No llamar a MP API

- [x] **admin.controller.ts** — agregar `confirmBankTransfer(orderId)`
  - Buscar payment pending con payment_method='bank_transfer' para ese orderId
  - Actualizar payment + order en transacción
  - Incluir `paymentMethod` en `getAdminPayments`

- [x] **admin.routes.ts** — agregar `POST /admin/orders/:id/confirm-transfer` con Swagger docs

- [x] **Swagger** — documentar nuevo endpoint

## Dev Notes

### Migration 035_bank_transfer.sql

```sql
-- Columnas de transferencia en branding
ALTER TABLE branding
  ADD COLUMN IF NOT EXISTS bank_transfer_cvu         VARCHAR(22),
  ADD COLUMN IF NOT EXISTS bank_transfer_alias       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_transfer_holder_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_transfer_bank_name   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_transfer_notes       TEXT;

-- Actualizar CHECK constraint de payment_gateway
ALTER TABLE branding DROP CONSTRAINT IF EXISTS branding_payment_gateway_check;
ALTER TABLE branding ADD CONSTRAINT branding_payment_gateway_check
  CHECK (payment_gateway IN ('checkout_pro', 'checkout_api', 'bank_transfer'));

-- Agregar payment_method a payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'mercadopago'
    CHECK (payment_method IN ('mercadopago', 'bank_transfer'));
```

### config.controller.ts — getBranding y updateBranding

`getBranding` debe incluir en la respuesta:
```typescript
{
  // campos existentes...
  bankTransferCvu:        r.bank_transfer_cvu ?? null,
  bankTransferAlias:      r.bank_transfer_alias ?? null,
  bankTransferHolderName: r.bank_transfer_holder_name ?? null,
  bankTransferBankName:   r.bank_transfer_bank_name ?? null,
  bankTransferNotes:      r.bank_transfer_notes ?? null,
}
```

`updateBranding` debe aceptar los mismos campos opcionales y mapearlos a snake_case para el UPDATE dinámico. El patrón ya existe para los campos actuales — extenderlo del mismo modo.

### payments.service.ts — initiateCheckout con bank_transfer

```typescript
// Al inicio de initiateCheckout, después de obtener el branding:
if (branding.payment_gateway === 'bank_transfer') {
  // Reutilizar pago pending existente si lo hay
  const existing = await pool.query(
    `SELECT id FROM payments
     WHERE order_id = $1 AND payment_method = 'bank_transfer' AND status = 'pending'`,
    [orderId]
  );
  if (existing.rowCount === 0) {
    await pool.query(
      `INSERT INTO payments (order_id, status, payment_method)
       VALUES ($1, 'pending', 'bank_transfer')`,
      [orderId]
    );
  }
  return {
    method: 'bank_transfer' as const,
    bankDetails: {
      cvu:        branding.bank_transfer_cvu ?? null,
      alias:      branding.bank_transfer_alias ?? null,
      holderName: branding.bank_transfer_holder_name ?? null,
      bankName:   branding.bank_transfer_bank_name ?? null,
      notes:      branding.bank_transfer_notes ?? null,
      amount:     order.total_amount,
    },
  };
}
// ... lógica existente de MP
```

El tipo de retorno de `initiateCheckout` debe ser una union:
```typescript
type CheckoutResult =
  | { method: 'checkout_pro'; checkoutUrl: string }
  | { method: 'checkout_api'; publicKey: string }
  | { method: 'bank_transfer'; bankDetails: BankDetails }
```

### admin.controller.ts — confirmBankTransfer

```typescript
export async function confirmBankTransfer(req, res, next) {
  const orderId = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `SELECT id FROM payments
       WHERE order_id = $1 AND payment_method = 'bank_transfer' AND status = 'pending'`,
      [orderId]
    );
    if (paymentRes.rowCount === 0) {
      throw new AppError(404, 'No hay pago pendiente de transferencia para este pedido');
    }

    await client.query(
      `UPDATE payments SET status = 'approved', paid_at = NOW() WHERE id = $1`,
      [paymentRes.rows[0].id]
    );
    await client.query(
      `UPDATE orders SET status = 'paid' WHERE id = $1`,
      [orderId]
    );

    await client.query('COMMIT');
    res.status(200).json({ data: { orderId, status: 'paid' } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}
```

### admin.routes.ts

```typescript
router.post('/orders/:id/confirm-transfer', authMiddleware, requireRole([ROLES.ADMIN]), confirmBankTransferHandler);
```

### getAdminPayments — agregar paymentMethod

En la query SQL de `getAdminPayments` agregar `p.payment_method` al SELECT y mapearlo como `paymentMethod` en la respuesta.

### Depende de
- Epic 10 done (gateway de pago configurable existente)

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
- `035_bank_transfer.sql`: columnas `bank_transfer_*` en `branding`, CHECK constraint actualizado para incluir `bank_transfer`, columna `payment_method` en `payments`
- `find-branding.ts` y `update-branding.ts`: extendidos con los nuevos campos
- `config.controller.ts`: refactorizado `updateBranding` a UPDATE dinámico; helper `mapBranding`; `updatePaymentGateway` acepta `bank_transfer`; `uploadBrandingLogoHandler` usa `mapBranding`
- `payments.service.ts`: `initiateCheckout` maneja `bank_transfer` — lee columnas del branding, reutiliza pago pending si existe, retorna `{ type: 'bank_transfer', bankDetails }`
- `admin/queries/payments.ts`: agrega `p.payment_method` al SELECT
- `admin.controller.ts`: agrega `paymentMethod` en respuesta de `getAdminPayments`; nuevo `confirmBankTransfer` con transacción
- `admin.routes.ts`: `POST /admin/orders/:id/confirm-transfer` con Swagger docs
- TypeScript sin errores; tests pre-existentes no regresionados

### File List
- jedami-bff/src/database/migrations/035_bank_transfer.sql (nuevo)
- jedami-bff/src/modules/config/queries/find-branding.ts
- jedami-bff/src/modules/config/queries/update-branding.ts
- jedami-bff/src/modules/config/config.controller.ts
- jedami-bff/src/modules/payments/payments.service.ts
- jedami-bff/src/modules/admin/queries/payments.ts
- jedami-bff/src/modules/admin/admin.controller.ts
- jedami-bff/src/routes/admin.routes.ts
