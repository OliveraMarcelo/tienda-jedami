# Epic 12: Plataforma Multi-Tenant — Jedami como SaaS

**Estado:** backlog
**Depende de:** Todas las épicas anteriores completadas (sistema single-tenant estable ✓)
**Próxima migración disponible:** 044

---

## Objetivo

Convertir Jedami de un sistema single-tenant en una **plataforma SaaS** donde cualquier negocio puede tener su propio espacio aislado, pagar una suscripción mensual y vender en modalidad minorista y/o mayorista.

---

## Schema actual (referencia — 043 migraciones aplicadas)

Las 28 tablas actuales que requieren `tenant_id`:

| Grupo | Tablas |
|-------|--------|
| Usuarios | `users`, `customers` |
| Productos | `products`, `categories`, `variants`, `stock`, `stock_adjustments`, `product_images`, `product_prices` |
| Configuración catálogo | `sizes`, `colors`, `price_modes`, `purchase_types`, `customer_types` |
| Descuentos | `quantity_discount_rules`, `curva_discount_rules` |
| Pedidos y pagos | `orders`, `order_items`, `payments`, `payment_gateway_rules` |
| POS | `pos_devices`, `pos_payment_intents` |
| Branding/Config | `branding` |
| Marketing | `banners`, `announcements` |

Tablas globales (sin `tenant_id` — compartidas por toda la plataforma):
- `roles`, `user_roles`, `refresh_tokens`

---

## Fases de implementación

```
Fase 1 — Fundación        → tenant_id en todo el sistema, middleware tenant
Fase 2 — Billing SaaS     → MP PreApproval, planes, webhook de suscripciones
Fase 3 — Onboarding       → registro de tenants, flujo de activación
Fase 4 — Módulos extra    → hardware, grocery, restaurant (por demanda)
```

Las fases 1 y 2 son bloqueantes entre sí y deben implementarse en orden.
La fase 3 puede solaparse con la fase 2.
La fase 4 es completamente independiente y se implementa según demanda.

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
  **Then** existe un registro en `tenants` con `id = 1, slug = 'jedami'` y `subscription_status = 'active'`.

- **Given** los planes definidos,
  **When** se consulta `plans`,
  **Then** existen los planes `starter`, `pro`, `full` con sus `features` JSONB y precios en USD.

**Tareas técnicas:**
- [ ] Migration `044_multitenant_core.sql`:
  ```sql
  CREATE TABLE plans (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(50) NOT NULL UNIQUE,    -- 'starter', 'pro', 'full'
    price_usd        NUMERIC(8,2) NOT NULL,
    price_usd_annual NUMERIC(8,2) NOT NULL,
    features         JSONB NOT NULL DEFAULT '{}',    -- { point: true, discounts: true, ... }
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE tenants (
    id                    SERIAL PRIMARY KEY,
    slug                  VARCHAR(100) NOT NULL UNIQUE,
    name                  VARCHAR(200) NOT NULL,
    plan_id               INT NOT NULL REFERENCES plans(id),
    subscription_status   VARCHAR(20) NOT NULL DEFAULT 'free'
                            CHECK (subscription_status IN ('free','pending','active','paused','cancelled')),
    mp_subscription_id    VARCHAR(200),
    mp_payer_email        VARCHAR(255),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE tenant_modules (
    tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module      VARCHAR(50) NOT NULL,               -- 'clothing', 'point', 'reports'
    enabled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, module)
  );

  CREATE TABLE subscription_payments (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INT NOT NULL REFERENCES tenants(id),
    mp_payment_id       VARCHAR(200),
    mp_subscription_id  VARCHAR(200),
    amount              NUMERIC(10,2),
    status              VARCHAR(20),
    event_type          VARCHAR(50),
    raw_data            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- [ ] Migration `045_seed_plans.sql` — insertar planes starter/pro/full con precios y features JSONB:
  ```sql
  INSERT INTO plans (name, price_usd, price_usd_annual, features) VALUES
    ('starter', 80, 800,  '{"point": false, "discounts": false, "custom_domain": false}'),
    ('pro',     150, 1500, '{"point": true,  "discounts": true,  "custom_domain": false}'),
    ('full',    250, 2500, '{"point": true,  "discounts": true,  "custom_domain": true}');
  ```
- [ ] Migration `046_seed_default_tenant.sql` — insertar Jedami como tenant_id = 1:
  ```sql
  INSERT INTO tenants (id, slug, name, plan_id, subscription_status)
  VALUES (1, 'jedami', 'Jedami', (SELECT id FROM plans WHERE name = 'full'), 'active');

  INSERT INTO tenant_modules (tenant_id, module) VALUES
    (1, 'clothing'),
    (1, 'point'),
    (1, 'discounts'),
    (1, 'reports');
  ```

---

### Story 12-2: tenant_id en tablas existentes

**Como** desarrollador,
**quiero** agregar `tenant_id` a todas las tablas existentes,
**para** aislar completamente los datos entre tenants.

**Criterios de aceptación:**

- **Given** la migración aplicada,
  **When** se consultan datos existentes,
  **Then** todos los registros tienen `tenant_id = 1` (el tenant por defecto Jedami).

- **Given** dos tenants con productos distintos,
  **When** se consultan los productos de cada uno,
  **Then** cada tenant solo ve sus propios productos.

**Tareas técnicas:**
- [ ] Migration `047_tenant_id_all_tables.sql`:
  ```sql
  -- Grupo 1: Usuarios y clientes
  ALTER TABLE users      ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE customers  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);

  -- Grupo 2: Catálogo
  ALTER TABLE products          ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE categories        ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE variants          ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE product_images    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE product_prices    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE sizes             ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE colors            ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE price_modes       ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);

  -- Grupo 3: Pedidos y pagos
  ALTER TABLE orders                 ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE order_items            ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE payments               ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE payment_gateway_rules  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);

  -- Grupo 4: Configuración del sistema
  ALTER TABLE purchase_types   ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE customer_types   ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);

  -- Grupo 5: Descuentos
  ALTER TABLE quantity_discount_rules ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE curva_discount_rules    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);

  -- Grupo 6: POS
  ALTER TABLE pos_devices          ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE pos_payment_intents  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);

  -- Grupo 7: Branding y marketing
  ALTER TABLE branding       ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE banners        ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE announcements  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);

  -- stock y stock_adjustments se acceden via variant_id → tenant implícito por variants
  ALTER TABLE stock              ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);
  ALTER TABLE stock_adjustments  ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 REFERENCES tenants(id);

  -- Índices por tenant_id en tablas más consultadas
  CREATE INDEX idx_products_tenant          ON products(tenant_id);
  CREATE INDEX idx_categories_tenant        ON categories(tenant_id);
  CREATE INDEX idx_orders_tenant            ON orders(tenant_id);
  CREATE INDEX idx_payments_tenant          ON payments(tenant_id);
  CREATE INDEX idx_customers_tenant         ON customers(tenant_id);
  CREATE INDEX idx_payment_gw_rules_tenant  ON payment_gateway_rules(tenant_id);
  CREATE INDEX idx_variants_tenant          ON variants(tenant_id);
  CREATE INDEX idx_branding_tenant          ON branding(tenant_id);
  CREATE INDEX idx_banners_tenant           ON banners(tenant_id);
  CREATE INDEX idx_announcements_tenant     ON announcements(tenant_id);

  -- Email único por tenant (no global)
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
  ALTER TABLE users ADD CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email);

  -- Categories único por tenant
  ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
  ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;
  ALTER TABLE categories ADD CONSTRAINT uq_categories_tenant_name UNIQUE (tenant_id, name);
  ALTER TABLE categories ADD CONSTRAINT uq_categories_tenant_slug UNIQUE (tenant_id, slug);

  -- Sizes único por tenant
  ALTER TABLE sizes DROP CONSTRAINT IF EXISTS sizes_label_key;
  ALTER TABLE sizes ADD CONSTRAINT uq_sizes_tenant_label UNIQUE (tenant_id, label);

  -- Colors único por tenant
  ALTER TABLE colors DROP CONSTRAINT IF EXISTS colors_name_key;
  ALTER TABLE colors ADD CONSTRAINT uq_colors_tenant_name UNIQUE (tenant_id, name);

  -- payment_gateway_rules único por tenant
  ALTER TABLE payment_gateway_rules DROP CONSTRAINT IF EXISTS payment_gateway_rules_customer_type_gateway_key;
  ALTER TABLE payment_gateway_rules ADD CONSTRAINT uq_pgr_tenant_ct_gw UNIQUE (tenant_id, customer_type, gateway);
  ```

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
  - Consulta `tenants` por slug → carga `plan_id`, `features`, `subscription_status`
  - Inyecta `req.tenantId`, `req.tenantPlan`, `req.tenantFeatures`
  - Cachea en Redis con TTL 60s: `tenant:{slug}` → `{id, planId, features, status}`
- [ ] Registrar `resolveTenant` como middleware global en `app.ts` antes de todas las rutas `/api/v1/`
- [ ] Actualizar **todos los repositories y queries** para agregar `AND tenant_id = $N`:
  - `products.repository.ts` — findAll, findById, create, update, findByCategory
  - `orders.repository.ts` — findByCustomerId, findById, create, findAll
  - `customers.repository.ts` — findByUserId, create
  - `payments.repository.ts` — findByOrderId, create, update
  - `users.repository.ts` — findByEmail, findById, create
  - `config.controller.ts` — branding, purchase_types, customer_types, sizes, colors, price_modes
  - `banners.controller.ts`, `announcements.controller.ts`
  - `pos.repository.ts`, `pos.service.ts`
  - `discounts` queries
- [ ] JWT payload extender con `tenantId`:
  ```typescript
  // Antes: { userId: 1, roles: ['admin'] }
  // Después: { userId: 1, tenantId: 1, roles: ['admin'] }
  ```
- [ ] Validar que `tenantId` del JWT coincida con `tenantId` del request
- [ ] Tests: aislamiento entre tenant_id=1 y tenant_id=2

---

### Story 12-4: Módulos verticales dinámicos por tenant

**Como** desarrollador,
**quiero** que las rutas de módulos verticales se registren solo si el tenant los tiene activos en `tenant_modules`,
**para** que cada tenant solo exponga los endpoints que le corresponden.

**Criterios de aceptación:**

- **Given** un tenant con módulo `clothing` activo,
  **When** llama a `GET /api/v1/products/variants`,
  **Then** responde correctamente.

- **Given** un tenant SIN módulo `clothing`,
  **When** llama a `GET /api/v1/products/variants`,
  **Then** responde 404.

- **Given** endpoint protegido con `requireFeature('point')`,
  **When** lo llama un tenant con plan `starter` (sin `point` en features),
  **Then** responde 403 con `{ upgrade: true, feature: 'point' }`.

**Tareas técnicas:**
- [ ] Crear `src/middleware/plan-guard.middleware.ts` con `requireFeature(feature: string)`:
  - Lee `req.tenantFeatures` inyectado por `resolveTenant`
  - Si la feature no está activa → 403 `{ upgrade: true, feature }`
- [ ] Agregar `requireFeature('point')` en todas las rutas de `/api/v1/admin/pos/`
- [ ] Agregar `requireFeature('discounts')` en endpoints de `quantity_discount_rules` y `curva_discount_rules`
- [ ] Agregar `requireFeature('checkout_api')` en `POST /payments/:id/process` (CardPaymentBrick)
- [ ] Registrar módulo activo al crear tenant (seed `tenant_modules` en 12-7)

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
  → Crea PreApproval en MP con auto_recurring (mensual, en USD)
  → Guarda mp_subscription_id en tenants
  → Devuelve { checkoutUrl } — el dueño paga en MP
  → MP webhookea POST /api/saas/webhook → subscription_status = 'active'
```

**Criterios de aceptación:**

- **Given** un tenant con `subscription_status = 'free'` elige plan Pro,
  **When** llama a `POST /api/saas/subscribe`,
  **Then** recibe una URL de checkout de MP para completar el pago.

- **Given** el dueño completó el pago en MP,
  **When** llega el webhook con `status = 'authorized'`,
  **Then** `tenants.subscription_status = 'active'`.

- **Given** MP no cobra una cuota (tarjeta vencida),
  **When** llega webhook con `status = 'paused'`,
  **Then** `tenants.subscription_status = 'paused'`.

- **Given** 3 cuotas rechazadas consecutivas,
  **When** MP cancela automáticamente,
  **Then** `subscription_status = 'cancelled'`.

**Tareas técnicas:**
- [ ] Módulo `src/modules/saas/`:
  - `saas.service.ts` — `createSubscription(tenantId, planId, payerEmail)`, `cancelSubscription(tenantId)`, `handleSaasWebhook(payload)`
  - `saas.controller.ts`
  - `saas.routes.ts` — montado en `/api/saas/` (sin `resolveTenant` — rutas de la plataforma)
- [ ] Usar `PreApproval` del SDK de MP (distinto a `Preference` y `Payment`)
- [ ] `external_reference` del PreApproval = `tenantId` para vincular con el tenant en el webhook
- [ ] Endpoint `POST /api/saas/webhook` — idempotente, guarda en `subscription_payments`
- [ ] Endpoint `DELETE /api/saas/subscribe` — cancela en MP y actualiza `tenants`
- [ ] Endpoint `GET /api/saas/subscription` — estado actual de la suscripción del tenant autenticado

---

### Story 12-6: Guard de acceso según estado de suscripción

**Como** sistema,
**quiero** bloquear el acceso al tenant cuando la suscripción está pausada o cancelada,
**para** que solo las tenants activas puedan operar.

**Criterios de aceptación:**

- **Given** tenant con `subscription_status = 'active'`,
  **When** un cliente visita el catálogo,
  **Then** ve los productos normalmente.

- **Given** tenant con `subscription_status = 'paused'`,
  **When** un cliente intenta crear un pedido,
  **Then** responde 503 "Esta tienda está temporalmente inactiva".

- **Given** tenant con `subscription_status = 'free'` usa feature del plan Pro,
  **When** llama al endpoint protegido,
  **Then** responde 403 con `{ upgrade: true }`.

**Tareas técnicas:**
- [ ] Agregar chequeo de `subscription_status` en `resolveTenant` o middleware separado `requireActiveTenant`
- [ ] Estados que permiten operar plenamente: `free`, `active`
- [ ] Estado `pending` → grace period de 24hs (tenant opera mientras el pago se procesa)
- [ ] Estados que bloquean escrituras: `paused` (catálogo visible, no puede crear pedidos), `cancelled` (bloqueado completamente)
- [ ] Catálogo público (GET /products, GET /config) sigue funcionando en `paused` para que el comprador vea que la tienda existe

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
  → Valida unicidad de slug y ownerEmail
  → Crea registro en tenants (status: 'free' si plan starter, 'pending' si plan pro/full)
  → Crea usuario con rol 'admin' para ese tenant
  → Activa módulo 'clothing' por defecto (+ 'point' y 'discounts' si plan >= pro)
  → Crea registro de branding vacío (store_name = name)
  → Seed de purchase_types, customer_types, price_modes por defecto
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

- **Given** nuevo tenant con plan Pro,
  **When** se registra,
  **Then** recibe `checkoutUrl` para pagar la suscripción en MP y módulos `point` y `discounts` activos.

**Tareas técnicas:**
- [ ] Endpoint `POST /api/saas/tenants` — transacción atómica:
  1. Crear `tenants`
  2. Crear `users` con tenant_id + hash de password
  3. Asignar rol `admin` en `user_roles`
  4. Insertar en `tenant_modules` (clothing siempre + extras según plan)
  5. Insertar `branding` vacío con tenant_id
  6. Copiar seed de `purchase_types`, `customer_types`, `price_modes` del tenant 1 como defaults
  7. Copiar seed de `sizes` y `colors` del tenant 1 como defaults
  8. Si plan pago → `createSubscription(tenantId, planId, ownerEmail)`
- [ ] Validar unicidad de `slug` (global) y `ownerEmail` dentro del tenant

---

### Story web-12-1: UI de registro de nuevo tenant (onboarding)

**Como** nuevo cliente,
**quiero** registrar mi tenant desde una página pública de Jedami,
**para** empezar a vender sin necesidad de configuración técnica.

**Pantallas:**
1. `/registro` — formulario: nombre del negocio, slug (con preview de URL `{slug}.jedami.com`), email, contraseña, plan
2. Selector de plan con tabla comparativa Starter / Pro / Full
3. Si plan pago → redirect a MP para suscripción
4. Callback → `/bienvenida` con checklist de primeros pasos (subir logo, cargar productos, configurar branding)

**Depende de:** 12-7 (BFF done)

---

### Story web-12-2: Panel de suscripción del dueño de tenant

**Como** dueño de tenant,
**quiero** ver y gestionar mi suscripción desde el panel,
**para** poder upgradar, cancelar o ver el historial de pagos.

**Pantallas:**
- `/admin/suscripcion` — estado actual (badge), plan activo, fecha próximo cobro, historial de pagos
- Botón "Cambiar plan" → nuevo checkout MP (upgrade)
- Botón "Cancelar suscripción" → confirmación + aviso de pérdida de datos

**Depende de:** 12-5, 12-6 (BFF done)

---

### Story web-12-3: Superadmin — Panel de gestión de tenants

**Como** dueño de la plataforma Jedami (superadmin),
**quiero** ver todas las tenants registradas, sus estados y sus suscripciones,
**para** gestionar la plataforma.

**Pantallas:**
- `/superadmin/tenants` — tabla: nombre, plan, status (badge), fecha creación, último pago, MRR
- Filtros por estado de suscripción y plan
- Acciones: pausar/reactivar tenant manualmente, cambiar plan sin pago (promo/cortesía)

**Nota:** requiere nuevo rol `superadmin` en la tabla `roles` — separado del rol `admin` de tenant.

**Depende de:** 12-5, 12-7 (BFF done)

---

## Consideraciones de arquitectura

### JWT multi-tenant
```typescript
// Payload actual:
{ userId: 1, roles: ['admin'] }

// Payload multi-tenant:
{ userId: 1, tenantId: 1, roles: ['admin'] }
```
El `resolveTenant` middleware valida que `tenantId` del JWT coincida con el del request (header o subdominio).

### Redis — claves namespaciadas por tenant
```
# Antes (single-tenant):
config:all
catalog:*

# Después (multi-tenant):
tenant:{slug}          → metadatos del tenant (60s TTL)
config:{tenantId}:all  → config del tenant (300s TTL)
catalog:{tenantId}:*   → catálogo del tenant
```

### Credenciales MP por tenant (fase futura)
Actualmente todas las tenants usan las credenciales MP de la plataforma. En el futuro, cada tenant puede conectar su propia cuenta MP (campo `mp_access_token` en `tenants`). Implica construir el cliente MP por request en vez de uno global.

### Migrations sin downtime
Al agregar `tenant_id` a tablas grandes (`products`, `orders`, `payments`), usar `DEFAULT 1` para que el ALTER TABLE no requiera lock. Una vez migrados todos los registros, el DEFAULT puede removerse.

### Unicidades que cambian de global a por-tenant
| Tabla | Constraint actual | Nuevo constraint |
|-------|------------------|-----------------|
| `users` | `UNIQUE(email)` | `UNIQUE(tenant_id, email)` |
| `categories` | `UNIQUE(name)`, `UNIQUE(slug)` | `UNIQUE(tenant_id, name)`, `UNIQUE(tenant_id, slug)` |
| `sizes` | `UNIQUE(label)` | `UNIQUE(tenant_id, label)` |
| `colors` | `UNIQUE(name)` | `UNIQUE(tenant_id, name)` |
| `payment_gateway_rules` | `UNIQUE(customer_type, gateway)` | `UNIQUE(tenant_id, customer_type, gateway)` |
| `purchase_types` | `UNIQUE(code)` | `UNIQUE(tenant_id, code)` |
| `customer_types` | `UNIQUE(code)` | `UNIQUE(tenant_id, code)` |

---

## Resumen de stories y migraciones

| Story | Track | Fase | Migraciones | Estado |
|-------|-------|------|-------------|--------|
| 12-1 | BFF | 1 | 044, 045, 046 | backlog |
| 12-2 | BFF | 1 | 047 | backlog |
| 12-3 | BFF | 1 | (solo código) | backlog |
| 12-4 | BFF | 1 | (solo código) | backlog |
| 12-5 | BFF | 2 | (solo código) | backlog |
| 12-6 | BFF | 2 | (solo código) | backlog |
| 12-7 | BFF | 3 | (solo código) | backlog |
| web-12-1 | WEB | 3 | — | backlog |
| web-12-2 | WEB | 3 | — | backlog |
| web-12-3 | WEB | 3 | — | backlog |
