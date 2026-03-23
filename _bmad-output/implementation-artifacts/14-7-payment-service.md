# Story 14.7: Extracción del Servicio de Pagos (payment-service)

Status: backlog

## Story

Como desarrollador,
quiero extraer toda la lógica de pagos (Mercado Pago + transferencia bancaria + webhook) del BFF a un microservicio independiente (`jedami-payments`),
para poder iterar sobre los gateways de pago de forma aislada, desplegar cambios de pagos sin tocar el BFF, y preparar la incorporación de nuevos medios de pago en el futuro.

## Contexto

Actualmente el BFF maneja toda la lógica de pagos directamente:
- `payments.service.ts` — Checkout Pro, Checkout API, bank transfer, retry, webhook HMAC verification
- `payments.controller.ts` — rutas HTTP del flujo de checkout
- `payments.repository.ts` — queries sobre tabla `payments`
- Dependencias: `mercadopago` SDK, credenciales MP (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`)

El payment-service centraliza todo esto. El BFF deja de depender del SDK de Mercado Pago y de las credenciales MP.

**Prerrequisito:** Ninguno. Esta story es independiente y puede implementarse sin 14-1 ni 14-6.

## Acceptance Criteria

1. **Given** existe el directorio `jedami-payments/` en el monorepo
   **Then** es una app Express independiente con su propio `package.json`, puerto y Dockerfile

2. **Given** el BFF necesita iniciar un checkout
   **When** llama `POST http://payment-service/checkout/:orderId` con header `X-User-Id` y `X-User-Roles`
   **Then** el payment-service ejecuta la lógica de gateway (checkout_pro / checkout_api / bank_transfer)
   **And** retorna el mismo contrato que hoy: `{ data: { type, checkoutUrl? | publicKey? | bankDetails? } }`

3. **Given** el BFF necesita procesar un pago Checkout API
   **When** llama `POST http://payment-service/checkout/:orderId/process` con el body del CardPaymentBrick
   **Then** el payment-service llama a la API de Mercado Pago y retorna `{ data: { status, statusDetail } }`

4. **Given** el BFF necesita reintentar un pago fallido
   **When** llama `POST http://payment-service/checkout/:orderId/retry`
   **Then** el payment-service crea una nueva preferencia MP y retorna `{ data: { checkoutUrl } }`

5. **Given** Mercado Pago envía un webhook al BFF
   **When** el BFF lo recibe en `POST /api/v1/payments/webhook`
   **Then** el BFF lo proxea al payment-service: `POST http://payment-service/webhook`
   **And** el payment-service verifica la firma HMAC y actualiza orders + payments
   **And** retorna `{ received: true }`

6. **Given** el admin confirma una transferencia bancaria
   **When** el BFF llama `PATCH http://payment-service/orders/:orderId/confirm-transfer`
   **Then** el payment-service actualiza el pago a `approved` y el pedido a `paid`

7. **Given** docker-compose levanta
   **Then** el servicio `payments` corre en el puerto `3003` (interno) y está accesible desde el BFF como `http://payments:3003`

8. **Given** el BFF está actualizado
   **Then** `payments.service.ts` ya no contiene lógica de pagos (solo thin proxy HTTP)
   **And** el SDK `mercadopago` ya no está como dependencia del BFF
   **And** las variables `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` ya no son necesarias en el BFF

## Tasks / Subtasks

### jedami-payments/ — nuevo servicio

- [ ] Inicializar `jedami-payments/` con `npm init`, TypeScript, Express, pg, mercadopago
  ```
  jedami-payments/
  ├── src/
  │   ├── app.ts                  — Express + rutas
  │   ├── config/
  │   │   ├── database.ts         — pool pg (misma DB)
  │   │   ├── env.ts              — variables de entorno
  │   │   └── logger.ts           — pino
  │   ├── lib/
  │   │   └── app-error.ts        — AppError class
  │   ├── routes/
  │   │   └── payments.routes.ts
  │   ├── modules/
  │   │   └── payments/
  │   │       ├── payments.controller.ts
  │   │       ├── payments.service.ts     — lógica movida desde bff
  │   │       └── payments.repository.ts  — queries sobre tabla payments
  ├── package.json
  ├── tsconfig.json
  └── Dockerfile
  ```

- [ ] `POST /checkout/:orderId` — initiateCheckout
  - Header `X-User-Id: <userId>` (número), `X-User-Roles: admin,wholesale` (csv)
  - Lee gateway activo de tabla `branding`
  - Retorna `{ data: { type, checkoutUrl? | publicKey? | bankDetails? } }`

- [ ] `POST /checkout/:orderId/process` — processPayment (Checkout API)
  - Header `X-User-Id`
  - Body: payload nativo del CardPaymentBrick (snake_case)
  - Llama `mercadopago` SDK, actualiza `payments` y `orders`

- [ ] `POST /checkout/:orderId/retry` — retryPayment
  - Header `X-User-Id`, `X-User-Roles`
  - Admin puede reintentar cualquier pedido; comprador solo los suyos

- [ ] `POST /webhook` — processWebhook
  - Recibe headers `x-signature`, `x-request-id` y raw body (para verificación HMAC)
  - `express.raw({ type: '*/*' })` antes del handler para conservar body original

- [ ] `PATCH /orders/:orderId/confirm-transfer` — confirmTransfer (admin)
  - Header `X-User-Roles` debe incluir `admin`
  - Actualiza payment a `approved` y order a `paid`

- [ ] `GET /health` — `{ status: 'ok' }`

### jedami-bff/ — adaptar para usar payment-service

- [ ] `src/lib/payment-client.ts` — cliente HTTP interno:
  ```typescript
  export async function checkoutViaPaymentService(
    orderId: number, userId: number, roles: string[]
  ): Promise<CheckoutResult>

  export async function processPaymentViaService(
    orderId: number, userId: number, body: unknown
  ): Promise<PaymentResult>

  export async function retryPaymentViaService(
    orderId: number, userId: number, roles: string[]
  ): Promise<RetryResult>

  export async function proxyWebhook(
    rawBody: string, signature: string, requestId: string
  ): Promise<{ received: boolean }>

  export async function confirmTransferViaService(
    orderId: number
  ): Promise<void>
  ```
  Usa `fetch` nativo (Node 18+). Propaga headers `X-User-Id`, `X-User-Roles`.

- [ ] `modules/payments/payments.controller.ts` — reemplazar llamadas a `paymentsService.*` con `payment-client.*`

- [ ] `modules/payments/payments.service.ts` — puede eliminarse o quedar vacío (la lógica se movió)

- [ ] `app.ts` — el middleware `express.raw` para el webhook ahora solo proxea; mantener si se necesita el body original para el proxy

- [ ] Eliminar `mercadopago` de `jedami-bff/package.json`

- [ ] Variables de entorno:
  ```env
  PAYMENT_SERVICE_URL=http://payments:3003
  ```
  Eliminar del BFF: `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`, `MP_WEBHOOK_URL`

### Docker / infraestructura

- [ ] `jedami-payments/Dockerfile`:
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --omit=dev
  COPY dist/ dist/
  EXPOSE 3003
  CMD ["node", "dist/app.js"]
  ```

- [ ] `docker-compose.yml` — agregar servicio `payments`:
  ```yaml
  payments:
    build: ./jedami-payments
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - MP_ACCESS_TOKEN=${MP_ACCESS_TOKEN}
      - MP_PUBLIC_KEY=${MP_PUBLIC_KEY}
      - MP_WEBHOOK_SECRET=${MP_WEBHOOK_SECRET}
      - MP_WEBHOOK_URL=${MP_WEBHOOK_URL}
      - FRONTEND_URL=${FRONTEND_URL}
    depends_on:
      - postgres
    restart: unless-stopped
  ```
  Agregar `payments` a la lista de dependencias del servicio `bff`.

- [ ] Makefile — agregar targets `payments-dev`, `payments-build`

### Prueba de regresión manual

- [ ] Checkout Pro: flujo completo desde "Pagar" → redirect MP → webhook → pedido paid
- [ ] Checkout API: flujo completo con CardPaymentBrick → pago aprobado/rechazado
- [ ] Bank transfer: checkout devuelve datos bancarios → admin confirma → pedido paid
- [ ] Retry: reintentar pago fallido → nuevo checkoutUrl
- [ ] BFF y payments corriendo en docker-compose sin errores

## Dev Notes

### Comunicación BFF → payment-service

El BFF actúa como proxy de autenticación: valida el JWT y pasa `userId` y `roles` como headers internos. El payment-service confía en estos headers (solo accesible desde la red interna de Docker).

```
Cliente → [JWT] → BFF → [X-User-Id, X-User-Roles] → payment-service → DB + MP API
```

### Headers internos de autenticación

```typescript
// payment-client.ts
const headers = {
  'Content-Type': 'application/json',
  'X-User-Id': String(userId),
  'X-User-Roles': roles.join(','),
}
```

El payment-service lee:
```typescript
const userId = parseInt(req.headers['x-user-id'] as string, 10)
const roles = ((req.headers['x-user-roles'] as string) ?? '').split(',').filter(Boolean)
```

### Manejo del raw body para webhook

El BFF debe pasar el raw body original al payment-service para que la verificación HMAC de MP funcione:

```typescript
// BFF payments.controller.ts — webhook proxy
export async function webhook(req, res, next) {
  const rawBody = req.rawBody?.toString('utf-8') ?? JSON.stringify(req.body)
  const result = await proxyWebhook(
    rawBody,
    req.headers['x-signature'] as string ?? '',
    req.headers['x-request-id'] as string ?? '',
  )
  res.status(200).json(result)
}

// payment-client.ts
export async function proxyWebhook(rawBody, signature, requestId) {
  const res = await fetch(`${ENV.PAYMENT_SERVICE_URL}/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature,
      'x-request-id': requestId,
    },
    body: rawBody,
  })
  return res.json()
}
```

En el payment-service, el endpoint `/webhook` usa `express.text({ type: '*/*' })` para preservar el body como string:

```typescript
router.post('/webhook', express.text({ type: '*/*' }), webhookHandler)
```

### Variables de entorno del payment-service

```env
PORT=3003
DATABASE_URL=postgresql://...
MP_ACCESS_TOKEN=...
MP_PUBLIC_KEY=...
MP_WEBHOOK_SECRET=...
MP_WEBHOOK_URL=https://dominio/api/v1/payments/webhook
FRONTEND_URL=https://dominio
NODE_ENV=production
```

### Riesgo principal

El webhook de MP apunta a la URL del BFF (configurada en MP). El BFF lo proxea al payment-service internamente. Si el proxy falla (payment-service caído), el BFF debe responder 200 igual a MP para evitar reintentos excesivos, y loguear el error.

```typescript
// payment-client.ts — manejo de fallo en proxy webhook
try {
  const res = await fetch(...)
  return await res.json()
} catch (err) {
  logger.error({ err }, '[PAYMENT-CLIENT] payment-service unreachable on webhook')
  return { received: true } // no dejar que MP reintente
}
```

### Depende de

- Ninguna story previa de epic 14

### Diferencia con story 14-6 (media-service)

| Aspecto | media-service | payment-service |
|---|---|---|
| Puerto | 3002 | 3003 |
| Estado | Sin estado (solo archivos) | Con estado (DB) |
| Deps externas | Ninguna | Mercado Pago API |
| Credenciales | Ninguna | MP_ACCESS_TOKEN, etc. |
| Riesgo principal | Latencia uploads | Webhook proxy failure |

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
