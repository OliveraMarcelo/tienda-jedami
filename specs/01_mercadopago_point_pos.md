# Análisis Técnico: Integración MercadoPago Point (POS)

## Problema

El sistema de pagos actual soporta tres gateways (`checkout_pro`, `checkout_api`, `bank_transfer`). Se requiere integrar **MercadoPago Point** para cobros presenciales con dispositivo físico (lector de tarjeta) y/o QR dinámico en caja, operado desde el panel web por el cajero/admin.

## Impacto Arquitectural

- **BFF** (jedami-bff): nuevo módulo `modules/pos/`, extensión de `payments.service.ts` (nuevo branch `mp_point`), extensión del webhook handler para topic `point_integration_wh`
- **Web** (jedami-web): store Pinia `usePosStore`, componente `PosPaymentPanel.vue`, integración en flujo de checkout, vista de configuración de dispositivos
- **Mobile** (jedami-mobile): no aplica en esta iteración — el POS es operado por el cajero desde la web
- **DB**: tabla `pos_devices`, tabla `pos_payment_intents`, nueva columna `mp_point` en constraints de `branding.payment_gateway` y `payments.payment_method`

## Propuesta de Solución

### Modo de operación

MP Point tiene dos modos de operación unificados bajo un mismo módulo `pos`:

- **Point Smart** — dispositivo físico con lector. El backend crea un payment intent vía API REST, MP lo despacha al dispositivo registrado, el cliente pasa la tarjeta, MP notifica el resultado vía webhook `point_integration_wh`.
- **QR Integrado** — QR dinámico en caja. Se crea una orden QR en MP, el cliente escanea con la app de MP. MP notifica vía webhook `merchant_order`.

### Endpoints de MP que se consumen

```
POST   /point/integration-api/devices/{deviceId}/payment-intents   → crear intent en dispositivo
GET    /point/integration-api/payment-intents/{paymentIntentId}    → consultar estado del intent
DELETE /point/integration-api/devices/{deviceId}/payment-intents   → cancelar intent activo
GET    /point/integration-api/devices                              → listar dispositivos vinculados
PUT    /point/integration-api/devices/{deviceId}                   → cambiar modo (PDV / STANDALONE)

Webhook (topic: point_integration_wh):
  POST /api/v1/payments/webhook  ← mismo endpoint existente
  body: { action: 'point_integration_wh', data: { id: '<intentId>' } }
```

> **Nota:** Point Integration API no tiene clase nativa en el SDK `mercadopago@^2.x`. Las llamadas se hacen con `fetch` directo usando `Authorization: Bearer MP_ACCESS_TOKEN`.

### Nuevo módulo `modules/pos/`

```
modules/pos/
  pos.controller.ts
  pos.service.ts
  pos.repository.ts
  pos.entity.ts
  queries/
    find-device-by-id.ts
    find-intent-by-order-id.ts    ← busca intent activo (open/on_terminal/processing)
    find-intent-by-mp-id.ts
    upsert-intent.ts
```

### Entidades

```typescript
// pos.entity.ts
export interface PosDevice {
  id: number;
  mp_device_id: string;        // id del dispositivo en MP
  name: string;                // nombre legible ("Caja 1")
  operating_mode: 'PDV' | 'STANDALONE';
  active: boolean;
  created_at: Date;
}

export interface PosPaymentIntent {
  id: number;
  device_id: number;           // FK → pos_devices.id
  order_id: number;            // FK → orders.id
  mp_intent_id: string;        // id del intent en MP
  status: 'open' | 'on_terminal' | 'processing' | 'processed' | 'abandoned' | 'cancelled' | 'error';
  mp_payment_id: string | null; // se llena cuando MP notifica el pago
  created_at: Date;
  updated_at: Date;
}
```

### Nuevos endpoints en BFF

```
# Gestión de dispositivos (solo admin)
GET  /api/v1/pos/devices           → listar dispositivos en DB local
POST /api/v1/pos/devices/sync      → importar dispositivos de MP y sincronizar con DB

# Operación POS (solo admin/cajero)
POST   /api/v1/pos/orders/:orderId/intent  → crear payment intent en el dispositivo activo
GET    /api/v1/pos/orders/:orderId/intent  → consultar estado del intent actual
DELETE /api/v1/pos/orders/:orderId/intent  → cancelar intent activo
```

> El `deviceId` nunca viene del cliente — el BFF lo resuelve desde DB (dispositivo activo).

### Extensión de `payments.service.ts`

```typescript
// initiateCheckout — nuevo branch
if (gateway === 'mp_point') {
  return await posService.createIntent(orderId, userId);
  // retorna { type: 'pos', intentId, deviceName }
}
```

El frontend recibe `type: 'pos'` y monta `PosPaymentPanel.vue` en lugar de redirigir a MP.

### Extensión del webhook

```typescript
// processWebhook — nuevo handler para Point
if (action === 'point_integration_wh') {
  return await posService.processPointWebhook(data.id);
}
```

`processPointWebhook` consulta `GET /point/integration-api/payment-intents/{id}` para obtener el `payment_id` real, luego actualiza `pos_payment_intents` y `payments` con el estado final. Misma verificación HMAC-SHA256 ya implementada.

### Llamada directa a la API de Point (sin SDK)

```typescript
const response = await fetch(
  `https://api.mercadopago.com/point/integration-api/devices/${deviceId}/payment-intents`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ENV.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `jedami-order-${orderId}-${Date.now()}`,
    },
    body: JSON.stringify({
      amount: Math.round(totalAmount * 100), // Point trabaja en centavos (integer)
      description: `Pedido Jedami #${orderId}`,
      payment: { installments: 1, type: 'credit_card' },
      additional_info: {
        external_reference: String(orderId),
        print_on_terminal: true,
      },
    }),
  },
);
```

> **Importante:** `order.total_amount` está en pesos con decimales (NUMERIC 10,2). Multiplicar × 100 y redondear antes de enviar a MP.

### Frontend — store Pinia `usePosStore`

- State: `currentIntent`, `intentStatus`, `selectedDevice`, `isPolling`
- Actions: `createIntent(orderId)`, `pollStatus(orderId)`, `cancelIntent(orderId)`
- Polling: llama `GET /pos/orders/:orderId/intent` cada 3s, máximo 60 intentos (3 min), backoff exponencial a partir del intento 10

### Frontend — componente `PosPaymentPanel.vue`

Estados visuales mapeados:

| Status | Mensaje al cajero |
|---|---|
| `open` | Esperando acercamiento de tarjeta |
| `on_terminal` | Procesando en el lector |
| `processing` | En revisión por MP |
| `processed` | Aprobado / Rechazado (depende de `mp_payment_id`) |
| `abandoned` | Tiempo agotado — reintentar |
| `cancelled` | Cancelado por el cajero |
| `error` | Error — contactar soporte |

## Migraciones SQL

```sql
-- 038_mp_point_gateway.sql
BEGIN;

-- 1. Agregar 'mp_point' como gateway válido
ALTER TABLE branding DROP CONSTRAINT IF EXISTS branding_payment_gateway_check;
ALTER TABLE branding ADD CONSTRAINT branding_payment_gateway_check
  CHECK (payment_gateway IN ('checkout_pro', 'checkout_api', 'bank_transfer', 'mp_point'));

-- 2. Dispositivos POS registrados
CREATE TABLE pos_devices (
  id               SERIAL PRIMARY KEY,
  mp_device_id     VARCHAR(100) NOT NULL UNIQUE,
  name             VARCHAR(100) NOT NULL DEFAULT '',
  operating_mode   VARCHAR(20)  NOT NULL DEFAULT 'PDV'
                     CHECK (operating_mode IN ('PDV', 'STANDALONE')),
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pos_devices_active ON pos_devices(active);

-- 3. Intents de pago POS
CREATE TABLE pos_payment_intents (
  id              SERIAL PRIMARY KEY,
  device_id       INT NOT NULL REFERENCES pos_devices(id),
  order_id        INT NOT NULL REFERENCES orders(id),
  mp_intent_id    VARCHAR(200) NOT NULL UNIQUE,
  status          VARCHAR(20)  NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','on_terminal','processing','processed','abandoned','cancelled','error')),
  mp_payment_id   VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pos_intents_order_id  ON pos_payment_intents(order_id);
CREATE INDEX idx_pos_intents_mp_intent ON pos_payment_intents(mp_intent_id);
CREATE INDEX idx_pos_intents_status    ON pos_payment_intents(status);

-- 4. Agregar 'mp_point' a payment_method en payments
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('mercadopago', 'bank_transfer', 'mp_point'));

COMMIT;
```

## Variables de entorno

```bash
# jedami-bff/.env
MP_POINT_WEBHOOK_SECRET=   # secret de la suscripción webhook de Point en el panel de MP
                            # puede coincidir con MP_WEBHOOK_SECRET si se usa una sola suscripción
```

Configuración del webhook en el panel de MP:
- URL: `https://bff.jedami.com/api/v1/payments/webhook`
- Eventos: `point_integration_wh`

## Consideraciones de seguridad

| Riesgo | Mitigación |
|---|---|
| Webhook sin firma válida | Verificación HMAC-SHA256 ya implementada (mismo mecanismo) |
| Cliente enviando `deviceId` arbitrario | `deviceId` nunca viene del body del cliente — BFF lo resuelve desde DB |
| Intent duplicado en el mismo pedido | Verificar que no haya intent `open` o `on_terminal` antes de crear uno nuevo |
| Polling infinito en el frontend | MP marca el intent `abandoned` automáticamente; polling con máximo 60 intentos |
| Race condition webhook + polling | Update de `status` solo avanza hacia estados finales — operación idempotente |
| Access token en logs | `MP_ACCESS_TOKEN` solo existe en `ENV`, nunca se loguea |

## Plan de Implementación

### Epic 1 — Infraestructura DB y configuración

| Story | Descripción | Dependencias |
|---|---|---|
| **1.1** | Crear migración `038_mp_point_gateway.sql` | — |
| **1.2** | Agregar `MP_POINT_WEBHOOK_SECRET` a `config/env.ts`, `.env.example` y Render | — |

### Epic 2 — Módulo POS en BFF

| Story | Descripción | Dependencias |
|---|---|---|
| **2.1** | Crear `pos.entity.ts` con `PosDevice` y `PosPaymentIntent` | 1.1 |
| **2.2** | Crear los 4 query files en `modules/pos/queries/` | 2.1 |
| **2.3** | Crear `pos.repository.ts` | 2.2 |
| **2.4** | Crear `pos.service.ts` (`syncDevices`, `createIntent`, `getIntentStatus`, `cancelIntent`, `processPointWebhook`) | 2.3 |
| **2.5** | Crear `pos.controller.ts` y `routes/pos.routes.ts`, registrar en `routes/index.ts` | 2.4 |
| **2.6** | Extender `payments.service.ts` — branch `mp_point` en `initiateCheckout` | 2.4 |
| **2.7** | Extender webhook handler — topic `point_integration_wh` | 2.4 |

### Epic 3 — Frontend Web

| Story | Descripción | Dependencias |
|---|---|---|
| **3.1** | Store Pinia `usePosStore` con polling | 2.5 |
| **3.2** | Componente `PosPaymentPanel.vue` | 3.1 |
| **3.3** | Integración en flujo de checkout (cuando `type === 'pos'`) | 3.2 |
| **3.4** | Vista admin — listar dispositivos + sincronizar | 2.5 |

### Epic 4 — Observabilidad

| Story | Descripción | Dependencias |
|---|---|---|
| **4.1** | Logs estructurados `[POS]` con campos `{ orderId, intentId, deviceId, status }` | 2.4 |
| **4.2** | Documentación Swagger en `pos.routes.ts` | 2.5 |

### Orden de implementación

```
1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7
                                              ↓
                                         3.1 → 3.2 → 3.3 → 3.4
                                              ↓
                                         4.1 → 4.2
```

El camino crítico es el Epic 2. El frontend puede iniciar en paralelo desde Story 3.1 una vez que el contrato de endpoints esté definido (Story 2.5).
