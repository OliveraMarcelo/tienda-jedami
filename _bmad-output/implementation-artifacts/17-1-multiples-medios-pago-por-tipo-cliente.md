# Story 17.1: Múltiples Medios de Pago por Tipo de Cliente

Status: done

## Contexto

El sistema actualmente permite un único `payment_gateway` global (`checkout_pro` | `checkout_api` | `bank_transfer`) almacenado en `branding.payment_gateway`. No existe diferenciación por tipo de cliente (`retail` / `wholesale`).

El negocio necesita poder ofrecer distintos medios de pago según el tipo de comprador: por ejemplo, los mayoristas pueden pagar por transferencia bancaria o Checkout API (sin redirect), mientras que los minoristas solo ven Checkout Pro. Esta configuración debe ser manejable por el admin sin deploy.

## Story

Como administrador,
quiero configurar qué medios de pago están disponibles para cada tipo de cliente (minorista y mayorista),
para que cada tipo de comprador solo vea y pueda usar los métodos habilitados para su segmento.

## Acceptance Criteria

1. **Given** el admin accede a la configuración de medios de pago
   **When** consulta `GET /api/v1/config/payment-gateways`
   **Then** recibe la lista de gateways disponibles organizados por `customer_type` con su estado `active`

2. **Given** el admin habilita o deshabilita un gateway para un tipo de cliente
   **When** hace `PATCH /api/v1/config/payment-gateways`
   **Then** el cambio persiste y se invalida el cache de configuración

3. **Given** un comprador minorista inicia el checkout
   **When** el BFF resuelve el gateway a usar
   **Then** solo considera los gateways activos para `customer_type = 'retail'`

4. **Given** un comprador mayorista inicia el checkout
   **When** el BFF resuelve el gateway a usar
   **Then** solo considera los gateways activos para `customer_type = 'wholesale'`

5. **Given** un tipo de cliente tiene exactamente un gateway activo
   **When** inicia el checkout
   **Then** el BFF lo usa directamente sin intervención del usuario

6. **Given** un tipo de cliente tiene múltiples gateways activos
   **When** inicia el checkout
   **Then** el BFF retorna `{ type: 'select', options: [...] }` para que el frontend muestre el selector

7. **Given** un tipo de cliente no tiene ningún gateway activo
   **When** intenta iniciar el checkout
   **Then** el BFF retorna 422 con mensaje `"No hay medios de pago disponibles para este tipo de cliente"`

8. **Given** se intenta activar un gateway con nombre inválido
   **When** el BFF valida el payload
   **Then** retorna 400 con el listado de valores permitidos

## Tasks / Subtasks

### Task 1 — Migración SQL `039_payment_gateway_rules.sql`
- [x] Crear tabla `payment_gateway_rules`:
  ```sql
  CREATE TABLE payment_gateway_rules (
    id            SERIAL PRIMARY KEY,
    customer_type VARCHAR(20) NOT NULL
                    CHECK (customer_type IN ('retail', 'wholesale')),
    gateway       VARCHAR(20) NOT NULL
                    CHECK (gateway IN ('checkout_pro', 'checkout_api', 'bank_transfer', 'mp_point')),
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (customer_type, gateway)
  );
  ```
- [x] Seed inicial basado en el valor actual de `branding.payment_gateway`:
  ```sql
  -- Seed: el gateway actual se habilita para ambos tipos de cliente
  INSERT INTO payment_gateway_rules (customer_type, gateway, active)
  SELECT ct.code, b.payment_gateway, TRUE
  FROM customer_types ct
  CROSS JOIN branding b
  WHERE b.id = 1
  ON CONFLICT DO NOTHING;
  ```
- [x] Agregar índice:
  ```sql
  CREATE INDEX idx_pgr_customer_type_active ON payment_gateway_rules(customer_type, active);
  ```

### Task 2 — Query files en `modules/config/queries/`
- [x] `find-payment-gateway-rules.ts` — SELECT todos los rules (para `GET /config/payment-gateways`)
- [x] `find-active-gateways-by-customer-type.ts` — SELECT `gateway` WHERE `customer_type = $1 AND active = TRUE` ORDER BY `id`
- [x] `update-payment-gateway-rule.ts` — UPDATE/INSERT con ON CONFLICT para `(customer_type, gateway)`

### Task 3 — Service `config.service.ts` (o extensión de `config.controller.ts`)
- [x] `getPaymentGatewayRules()` — lee todos los rules agrupados por `customer_type`
- [x] `updatePaymentGatewayRule(customerType, gateway, active)` — valida valores, persiste, invalida cache
  - Valores válidos para `gateway`: `'checkout_pro' | 'checkout_api' | 'bank_transfer' | 'mp_point'`
  - Valores válidos para `customerType`: `'retail' | 'wholesale'`

### Task 4 — Extensión de `config.controller.ts`
- [x] `GET /api/v1/config/payment-gateways` — retorna rules agrupados:
  ```json
  {
    "retail":    [{ "gateway": "checkout_pro", "active": true }, ...],
    "wholesale": [{ "gateway": "bank_transfer", "active": true }, ...]
  }
  ```
- [x] `PATCH /api/v1/config/payment-gateways` — body `{ customer_type, gateway, active }`, solo `requireRole([ROLES.ADMIN])`
- [x] Agregar `paymentGatewayRules` al response de `GET /api/v1/config` para que el frontend lo consuma en carga inicial

### Task 5 — Extensión de `payments.service.ts`
- [x] `initiateCheckout(orderId, userId)`: resolver `customer_type` del usuario y cargar gateways activos
- [x] Si `activeGateways.length === 0` → `AppError(422, 'Sin medios de pago disponibles', ...)`
- [x] Si `activeGateways.length === 1` → usar ese gateway directamente (comportamiento actual)
- [x] Si `activeGateways.length > 1` → retornar `{ type: 'select', options: activeGateways }`
- [x] Nuevo endpoint `POST /api/v1/payments/checkout` acepta `{ orderId, selectedGateway? }`:
  - Si `selectedGateway` está presente y es válido para el `customer_type` del usuario → proceder con ese gateway
  - Si no está presente y hay un solo gateway activo → usar ese directamente
  - Si no está presente y hay múltiples → retornar `{ type: 'select', options: [...] }`

### Task 6 — Invalidación de cache
- [x] En `updatePaymentGatewayRule()`, llamar a `cacheDel(CONFIG_CACHE_KEY)` después de persistir
- [x] Verificar que `find-active-gateways-by-customer-type.ts` no use cache separado (leer siempre de DB o del cache de config unificado)

### Task 7 — Tests de integración (Vitest)
- [x] `GET /config/payment-gateways` retorna rules correctos por customer_type
- [x] `PATCH /config/payment-gateways` actualiza `active` correctamente
- [x] `PATCH /config/payment-gateways` con gateway inválido retorna 400
- [x] `POST /payments/checkout` para user retail con un solo gateway activo → usa ese gateway
- [x] `POST /payments/checkout` para user wholesale con múltiples gateways → retorna `type: 'select'`
- [x] `POST /payments/checkout` para user sin gateways activos → retorna 422

## Dev Notes

### Compatibilidad hacia atrás
El endpoint `POST /payments/checkout` puede coexistir con `POST /payments/initiate` (existente). Durante la transición se puede mantener `initiate` como alias que asume el único gateway activo del customer_type (compatibilidad 1:1 con comportamiento anterior).

### Sin romper el flujo existente
Si `branding.payment_gateway` sigue existiendo (no se elimina en esta story), el seed inicial de `payment_gateway_rules` garantiza que el gateway actual del admin quede habilitado para ambos customer_types. El BFF en `initiateCheckout` debe leer de `payment_gateway_rules` primero; si la tabla no tiene rows para ese `customer_type`, puede hacer fallback a `branding.payment_gateway` como compatibilidad.

### Customer type de usuarios sin perfil customer
Usuarios con rol `admin` no tienen fila en `customers`. El BFF debe manejar este caso: si no hay `customer_type`, no se puede iniciar checkout (los admins no compran).

### Cache
El cache key `CONFIG_CACHE_KEY` (Redis) debe invalidarse en cada `PATCH /config/payment-gateways`. Si `GET /config` incluye `paymentGatewayRules` en su response, un solo cache key cubre todo.

### Migración numérica
- Migración 038 → `038_discount_rules.sql` (ya existía)
- Migración 039 → `039_stock_adjustments.sql` (ya existía por desktop-8-2)
- Migración 040 → esta story (`040_payment_gateway_rules.sql`)

### Valores válidos de gateway
Sincronizar con el CHECK constraint de `branding` y de `pos_payment_intents` (Epic 11):
`'checkout_pro' | 'checkout_api' | 'bank_transfer' | 'mp_point'`

### Fallback logic en resolveActiveGateways
- Si hay reglas para el customer_type PERO todas están inactivas → retorna [] → 422
- Si no hay NINGUNA regla para el customer_type → fallback a `branding.payment_gateway`

### Referencias
- [Source: jedami-bff/src/database/migrations/025_payment_gateway.sql]
- [Source: jedami-bff/src/database/migrations/035_bank_transfer.sql]
- [Source: jedami-bff/src/modules/config/config.controller.ts]
- [Source: jedami-bff/src/modules/payments/payments.service.ts]
- [Source: jedami-bff/src/database/migrations/006_customers_orders.sql]
- [Spec: specs/01_mercadopago_point_pos.md]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- `resolveActiveGateways` fallback incorrecto: retornaba el gateway de branding cuando había reglas inactivas → corregido con check previo de existencia de reglas
- Tests fallaban con "deadlock detected" al correr en paralelo → fallos pre-existentes no causados por esta story
- Rate limit en tests: `beforeEach` con HTTP calls agotaba el límite de 20 req/15min → refactorizado con `beforeAll` para HTTP y `beforeEach` con SQL directo para re-seed
- **[Code Review]** `SupportedGateway` type no incluía `mp_point` → añadido; `executeGateway` lanza `AppError(422)` si recibe `mp_point` (no implementado hasta Epic 11)
- **[Code Review]** `existing.rowCount === 0` en `executeGateway` (bank_transfer) → `!existing.rowCount` para manejar `null` en pg v8+

### Completion Notes List
- Migración numerada `040_` (la story decía `039` pero ese número ya estaba tomado)
- `smartCheckout` (nuevo endpoint) y `initiateCheckout` (legacy) coexisten: el primero soporta `selectedGateway` en body, el segundo usa siempre el primero de la lista activa
- `GET /config` fue extendido para incluir `paymentGatewayRules` agrupados por customer_type
- Los fallos pre-existentes en auth.test.ts (2), auth-guards.test.ts (1) y webhook.test.ts (1) no fueron introducidos por esta story

### File List
- `jedami-bff/src/database/migrations/040_payment_gateway_rules.sql` (nuevo)
- `jedami-bff/src/modules/config/queries/find-payment-gateway-rules.ts` (nuevo)
- `jedami-bff/src/modules/config/queries/find-active-gateways-by-customer-type.ts` (nuevo)
- `jedami-bff/src/modules/config/queries/update-payment-gateway-rule.ts` (nuevo)
- `jedami-bff/src/modules/config/config.controller.ts` (modificado — getConfig + getPaymentGatewayRules + updatePaymentGatewayRule)
- `jedami-bff/src/routes/config.routes.ts` (modificado — GET/PATCH /payment-gateways)
- `jedami-bff/src/modules/payments/payments.service.ts` (modificado — resolveActiveGateways + smartCheckout + refactor initiateCheckout)
- `jedami-bff/src/modules/payments/payments.controller.ts` (modificado — smartCheckoutHandler)
- `jedami-bff/src/routes/payments.routes.ts` (modificado — POST /checkout)
- `jedami-bff/src/__tests__/payment-gateways.test.ts` (nuevo — 14 integration tests)

---

## Bug Fixes Post-Implementación

### Bug: seed inicial solo habilita 1 gateway por tipo de cliente

**Problema:** La migración 040 sembraba únicamente el gateway actual de `branding.payment_gateway` para cada tipo de cliente. Con solo 1 gateway activo, el backend ejecutaba el checkout directamente sin mostrar el selector (`type: 'select'` nunca se retornaba), impidiendo que el cliente eligiera entre múltiples métodos de pago.

**Fix:** Migración `043_seed_payment_gateway_rules.sql` — habilita `checkout_pro` y `bank_transfer` para `retail` y `wholesale` por defecto, usando `ON CONFLICT DO NOTHING` para ser idempotente:
```sql
INSERT INTO payment_gateway_rules (customer_type, gateway, active)
VALUES
  ('retail',    'checkout_pro',  TRUE),
  ('retail',    'bank_transfer', TRUE),
  ('wholesale', 'checkout_pro',  TRUE),
  ('wholesale', 'bank_transfer', TRUE)
ON CONFLICT (customer_type, gateway) DO NOTHING;
```

**Archivo:** `jedami-bff/src/database/migrations/043_seed_payment_gateway_rules.sql` (nuevo)
