# Epic 12: Plataforma Multi-Tenant — Jedami como SaaS

**Estado:** backlog
**Doc de arquitectura:** `docs/06-arquitectura/multitenant.md`
**Depende de:** Todas las épicas anteriores (el sistema single-tenant debe estar estable antes de migrar)

---

## Objetivo

Convertir Jedami de un sistema single-tenant en una **plataforma SaaS** donde cualquier negocio puede tener su propio espacio aislado, pagar una suscripción mensual y vender en modalidad minorista y/o mayorista.

---

## Fases de implementación

```
Fase 1 — Fundación        → tenant_id en todo el sistema, middleware tenant
Fase 2 — Billing SaaS     → MP PreApproval, planes, webhook de suscripciones
Fase 3 — Onboarding       → registro de tenants, flujo de activación
Fase 4 — Módulos extra    → hardware, grocery, restaurant (por demanda)
```

Las fases 1 y 2 son bloqueantes entre sí y deben implementarse en orden. La fase 3 puede solaparse con la fase 2. La fase 4 es completamente independiente y se implementa según demanda de clientes.

---

## FASE 1 — Fundación Multi-Tenant

---

### Story 12-1: Tablas core del sistema multi-tenant

**Como** desarrollador,
**quiero** crear las tablas `plans`, `tenants`, `tenant_modules` y `subscription_payments`,
**para** tener la base de datos lista para soportar múltiples tenants.

**Criterios de aceptación:**

- **Given** la migración aplicada,
  **When** se consulta la DB,
  **Then** existen las tablas `plans`, `tenants`, `tenant_modules`, `subscription_payments`.

- **Given** el sistema actual de Jedami,
  **When** se aplica la migración,
  **Then** existe un registro en `tenants` con `id = 1, slug = 'jedami'` (tenant por defecto).

- **Given** los planes definidos,
  **When** se consulta `plans`,
  **Then** existen al menos los planes `free`, `basic`, `pro` con sus `features` JSONB.

**Tareas técnicas:**
- [ ] Migration `027_stores_plans.sql`:
  ```sql
  CREATE TABLE plans (id, name, price, currency, frequency, frequency_type,
                      max_products, max_users, features JSONB, active, created_at)
  CREATE TABLE tenants (id, slug, name, plan_id, subscription_status,
                       mp_subscription_id, mp_payer_email, created_at, updated_at)
  CREATE TABLE tenant_modules (tenant_id, module, enabled_at)
  CREATE TABLE subscription_payments (id, tenant_id, mp_payment_id, mp_subscription_id,
                                       amount, status, event_type, raw_data, created_at)
  ```
- [ ] Migration `028_seed_plans.sql` — insertar planes free/basic/pro con features JSONB
- [ ] Migration `029_seed_default_tenant.sql` — insertar Jedami como tenant_id = 1

---

### Story 12-2: tenant_id en tablas del core

**Como** desarrollador,
**quiero** agregar `tenant_id` a todas las tablas existentes,
**para** aislar completamente los datos entre tenants.

**Criterios de aceptación:**

- **Given** la migración aplicada,
  **When** se consultan datos existentes,
  **Then** todos los registros tienen `tenant_id = 1` (el tenant por defecto).

- **Given** dos tenants con productos distintos,
  **When** se consultan los productos de cada una,
  **Then** cada tenant solo ve sus propios productos.

**Tareas técnicas:**
- [ ] Migration `030_tenant_id_core.sql`:
  ```sql
  ALTER TABLE users      ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE customers  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE products   ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE categories ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE orders     ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE payments   ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE branding   ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  -- Índices por tenant_id en tablas más consultadas
  CREATE INDEX idx_products_tenant  ON products(tenant_id);
  CREATE INDEX idx_orders_tenant    ON orders(tenant_id);
  CREATE INDEX idx_payments_tenant  ON payments(tenant_id);
  -- UNIQUE email por store, no global
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
  ALTER TABLE users ADD CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email);
  ```
- [ ] Módulo `tenant_modules` seed: insertar `(tenant_id=1, module='clothing')` para el tenant actual

---

### Story 12-3: Middleware resolveTenant + queries con tenant_id

**Como** desarrollador,
**quiero** que cada request HTTP identifique automáticamente a qué tenant pertenece y que todas las queries filtren por `tenant_id`,
**para** que nunca se mezclen datos entre tenants.

**Criterios de aceptación:**

- **Given** un request con header `X-Tenant-Slug: jedami`,
  **When** el middleware corre,
  **Then** `req.tenantId = 1` está disponible para todos los handlers.

- **Given** un request con slug desconocido,
  **When** el middleware corre,
  **Then** responde 404 "Tenant no encontrado".

- **Given** dos tenants distintos,
  **When** cada uno consulta `GET /api/v1/products`,
  **Then** cada uno solo ve sus propios productos.

**Tareas técnicas:**
- [ ] Crear `src/middleware/tenant.middleware.ts` con `resolveTenant`:
  - Lee `X-Tenant-Slug` header (o subdominio en producción)
  - Consulta `tenants` por slug
  - Inyecta `req.tenantId`, `req.tenantPlan`, `req.tenantFeatures`
  - Cachea el resultado en Redis con TTL corto (30s) para no golpear DB en cada request
- [ ] Registrar `resolveTenant` como middleware global en `app.ts` (antes de todas las rutas de `/api/v1/`)
- [ ] Actualizar **todas las queries existentes** para agregar `AND tenant_id = $N`:
  - `products.repository.ts` — findAll, findById, create, update
  - `orders.repository.ts` — findByCustomerId, findById, create
  - `customers.repository.ts` — findByUserId, create
  - `payments.repository.ts` — findByOrderId, create, update
  - `users.repository.ts` — findByEmail, findById
  - `config.controller.ts` — branding, purchase_types, customer_types
- [ ] Tests: verificar aislamiento entre tenant_id=1 y tenant_id=2

---

### Story 12-4: Módulos verticales dinámicos por tenant

**Como** desarrollador,
**quiero** que las rutas de módulos verticales (clothing, hardware, etc.) se registren solo si el tenant los tiene activos,
**para** que cada tenant solo exponga los endpoints que le corresponden.

**Criterios de aceptación:**

- **Given** un tenant con módulo `clothing` activo,
  **When** llama a `GET /api/v1/variants`,
  **Then** responde correctamente.

- **Given** un tenant SIN módulo `clothing`,
  **When** llama a `GET /api/v1/variants`,
  **Then** responde 404.

- **Given** endpoint protegido con `requireFeature('point')`,
  **When** lo llama un tenant con plan `free`,
  **Then** responde 403 con `{ upgrade: true }`.

**Tareas técnicas:**
- [ ] Crear `src/middleware/plan-guard.middleware.ts` con `requireFeature(feature: string)`
- [ ] Refactorizar `app.ts` para registrar rutas clothing condicionalmente según `tenant_modules`
- [ ] Agregar `requireFeature('checkout_api')` en `POST /payments/:id/process`
- [ ] Agregar `requireFeature('point')` en `POST /admin/orders/:id/point/initiate` (Epic 11)
- [ ] Agregar `requireFeature('reports')` en `GET /admin/dashboard` (cuando llegue Epic 12 Fase 3)

---

## FASE 2 — Billing del SaaS

---

### Story 12-5: Planes y suscripciones vía MP PreApproval

**Como** dueño de un tenant,
**quiero** elegir un plan y pagar mi suscripción mensual a Jedami,
**para** tener mi espacio activo en la plataforma.

**Flujo:**
```
POST /api/saas/subscribe { planId, payerEmail }
  → Crea PreApproval en MP con auto_recurring (mensual)
  → Guarda mp_subscription_id en tenants
  → Devuelve { checkoutUrl } — el dueño paga en MP
  → MP webhookea POST /api/saas/webhook → subscription_status = 'authorized'
```

**Criterios de aceptación:**

- **Given** un tenant con `subscription_status = 'free'` elige plan Basic,
  **When** llama a `POST /api/saas/subscribe`,
  **Then** recibe una URL de checkout de MP para completar el pago.

- **Given** el dueño completó el pago en MP,
  **When** llega el webhook con `status = 'authorized'`,
  **Then** `tenants.subscription_status = 'authorized'`.

- **Given** MP no cobra una cuota (tarjeta vencida),
  **When** llega webhook con `status = 'paused'`,
  **Then** `tenants.subscription_status = 'paused'` y el tenant deja de procesar pedidos.

- **Given** 3 cuotas rechazadas consecutivas,
  **When** MP cancela automáticamente,
  **Then** `subscription_status = 'cancelled'`.

**Tareas técnicas:**
- [ ] Módulo `src/modules/saas/`:
  - `saas.service.ts` — `createSubscription`, `cancelSubscription`, `handleSaasWebhook`
  - `saas.controller.ts`
  - `saas.routes.ts` — montado en `/api/saas/` (sin `resolveTenant` — es la plataforma, no el tenant)
- [ ] Usar `PreApproval` del SDK de MP (distinto a `Preference` y `Payment`)
- [ ] `external_reference` del PreApproval = `tenant_id` para vincular con el tenant
- [ ] Endpoint `POST /api/saas/webhook` — idempotente, guarda en `subscription_payments`
- [ ] Endpoint `DELETE /api/saas/subscribe` — cancela suscripción en MP y actualiza store
- [ ] Endpoint `GET /api/saas/subscription` — estado actual de la suscripción del tenant autenticado

---

### Story 12-6: Guard de acceso según estado de suscripción

**Como** sistema,
**quiero** bloquear el acceso al tenant cuando la suscripción está pausada o cancelada,
**para** que solo las tenants activas puedan operar.

**Criterios de aceptación:**

- **Given** tenant con `subscription_status = 'authorized'`,
  **When** un cliente visita el catálogo,
  **Then** ve los productos normalmente.

- **Given** tenant con `subscription_status = 'paused'`,
  **When** un cliente intenta crear un pedido,
  **Then** responde 403 "Este tenant está temporalmente inactiva".

- **Given** tenant con `subscription_status = 'free'`,
  **When** intenta usar un endpoint de plan Pro,
  **Then** responde 403 con `{ upgrade: true }`.

**Tareas técnicas:**
- [ ] Agregar chequeo de `subscription_status` en `resolveTenant` o en middleware separado `requireActiveTenant`
- [ ] Estados que permiten operar: `free`, `authorized`
- [ ] Estados que bloquean: `paused`, `cancelled`
- [ ] Estado `pending` → grace period de 24hs (tenant opera mientras el pago se procesa)

---

## FASE 3 — Onboarding de nuevas tenants

---

### Story 12-7: Registro y activación de un nuevo tenant

**Como** nuevo cliente de Jedami,
**quiero** registrar mi tenant en la plataforma,
**para** tener mi propio panel de administración y catálogo online.

**Flujo:**
```
POST /api/saas/tenants { name, slug, ownerEmail, ownerPassword, planId }
  → Crea registro en tenants (status: 'free' o 'pending' según plan)
  → Crea usuario con rol 'admin' en esa tenant
  → Activa módulo 'clothing' por defecto
  → Crea registro de branding vacío
  → Si plan != free → inicia flujo de suscripción MP (story 12-5)
  → Devuelve { tenantId, slug, checkoutUrl? }
```

**Criterios de aceptación:**

- **Given** datos válidos de nuevo tenant,
  **When** se llama a `POST /api/saas/tenants`,
  **Then** el tenant es creado con su admin y puede loguearse inmediatamente.

- **Given** slug ya existente,
  **When** se intenta registrar,
  **Then** error 409 "El slug ya está en uso".

- **Given** nuevo tenant con plan Basic,
  **When** se registra,
  **Then** recibe `checkoutUrl` para pagar la suscripción en MP.

**Tareas técnicas:**
- [ ] Endpoint `POST /api/saas/tenants` — crea store + admin + módulos por defecto
- [ ] Validar unicidad de `slug` y `ownerEmail`
- [ ] Seed de branding vacío (nombre del tenant, sin logo aún)
- [ ] Seed de configuración por defecto (purchase_types, customer_types, price_modes)

---

### Story web-12-1: UI de registro de nuevo tenant (onboarding)

**Como** nuevo cliente,
**quiero** registrar mi tenant desde una página pública de Jedami,
**para** empezar a vender sin necesidad de configuración técnica.

**Pantallas:**
1. `/registro-tenant` — formulario: nombre de tenant, slug (con preview de URL), email, contraseña, plan
2. Selector de plan con features comparadas (Free / Basic / Pro)
3. Si plan pago → redirect a MP para suscripción
4. Callback → `/panel/bienvenida` con checklist de primeros pasos

**Depende de:** 12-7 (BFF done)

---

### Story web-12-2: Panel de suscripción del dueño de tenant

**Como** dueño de tenant,
**quiero** ver y gestionar mi suscripción desde el panel,
**para** poder upgradar, cancelar o ver el historial de pagos.

**Pantallas:**
- `/admin/suscripcion` — estado actual, plan, próximo cobro, historial
- Botón "Cambiar plan" → nuevo checkout MP
- Botón "Cancelar suscripción" → confirmación → `DELETE /api/saas/subscribe`

**Depende de:** 12-5, 12-6 (BFF done)

---

### Story web-12-3: Superadmin — Panel de gestión de tenants

**Como** dueño de la plataforma Jedami (superadmin),
**quiero** ver todas las tenants registradas, sus estados y sus suscripciones,
**para** gestionar la plataforma.

**Pantallas:**
- `/superadmin/tenants` — tabla de todas las tenants: nombre, plan, status, fecha de creación, último pago
- Filtros por estado de suscripción
- Acción: pausar/reactivar tenant manualmente

**Depende de:** 12-5, 12-7 (BFF done)
**Nota:** requiere nuevo rol `superadmin` separado del rol `admin` de tenant

---

## Consideraciones de arquitectura

### JWT multi-tenant
El token JWT debe incluir `tenantId` además de `userId`:
```typescript
// Payload del JWT actual:
{ userId: 1, roles: ['admin'] }

// Payload multi-tenant:
{ userId: 1, tenantId: 1, roles: ['admin'] }
```
El `resolveTenant` middleware valida que el `tenantId` del JWT coincida con el del request.

### Credenciales MP por tenant (fase futura)
Actualmente todas las tenants usan las credenciales MP del dueño de la plataforma. En el futuro, cada tenant podría tener sus propias credenciales (campo `mp_access_token` en `tenants`). Esto requiere construir el cliente MP por request en vez de uno global.

### Redis y caché multi-tenant
Las claves de caché deben incluir `tenant_id`:
```
catalog:{tenantId}:*        (en vez de catalog:*)
product:{tenantId}:{id}     (en vez de product:{id})
admin:{tenantId}:dashboard
```

### Migrations sin downtime
Al agregar `tenant_id` a tablas grandes (`products`, `orders`), usar `DEFAULT 1` para evitar lock de tabla. Luego remover el DEFAULT una vez migrados todos los registros.

---

## Resumen de stories

| Story | Track | Fase | Descripción |
|-------|-------|------|-------------|
| 12-1 | BFF | 1 | Tablas core: plans, tenants, tenant_modules, subscription_payments |
| 12-2 | BFF | 1 | tenant_id en tablas existentes + constraints + índices |
| 12-3 | BFF | 1 | Middleware resolveTenant + queries con tenant_id |
| 12-4 | BFF | 1 | Módulos verticales dinámicos + requireFeature middleware |
| 12-5 | BFF | 2 | MP PreApproval — suscripciones + webhook /api/saas/webhook |
| 12-6 | BFF | 2 | Guard de acceso según subscription_status |
| 12-7 | BFF | 3 | Registro de nuevo tenant (onboarding) |
| web-12-1 | WEB | 3 | UI de registro/onboarding de tenant |
| web-12-2 | WEB | 3 | Panel de suscripción del dueño |
| web-12-3 | WEB | 3 | Superadmin — gestión de tenants |
