# Epic 12: Plataforma Multi-Tenant — Jedami como SaaS

**Estado:** backlog
**Depende de:** Todas las épicas anteriores completadas (sistema single-tenant estable ✓)
**Próxima migración disponible:** 044

---

## Objetivo

Convertir Jedami de un sistema single-tenant en una **plataforma SaaS** basada en el modelo
**Tenant → Account**, donde:
- Un **Tenant** es quien contrata y paga el SaaS (MarceDev, Clara, Don Lucho).
- Una **Account** es cada tienda/negocio dentro de un Tenant (jedami, ferretería-don-lucho).
- Un Tenant puede tener una o más Accounts según su plan.

---

## Jerarquía del modelo

```
plans
  └── tenants               ← paga el SaaS
        ├── subscription_payments
        └── accounts         ← cada tienda / negocio
              ├── account_modules
              └── [tablas operativas con account_id]
                    users, products, categories, customers,
                    orders, payments, branding, banners, etc.
```

---

## Schema actual (referencia — 043 migraciones aplicadas)

Las tablas operativas que recibirán `account_id`:

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

Tablas globales (sin `account_id` — compartidas por toda la plataforma):
- `roles`, `user_roles`, `refresh_tokens`

---

## Fases de implementación

```
Fase 1 — Fundación        → tablas Tenant/Account, account_id en todo, middleware
Fase 2 — Billing SaaS     → MP PreApproval a nivel Tenant, planes, webhook
Fase 3 — Onboarding       → registro de Tenants, flujo de activación, panel superadmin
Fase 4 — Módulos extra    → hardware, grocery, restaurant (por demanda)
```

---

## FASE 1 — Fundación Multi-Tenant

---

### Story 12-1: Tablas core del sistema multi-tenant

**Como** desarrollador,
**quiero** crear las tablas `plans`, `tenants`, `subscription_payments`, `accounts` y `account_modules`,
**para** tener la base de datos lista para soportar el modelo Tenant → Account.

**Criterios de aceptación:**

- **Given** la migración aplicada,
  **When** se consulta la DB,
  **Then** existen las tablas `plans`, `tenants`, `subscription_payments`, `accounts`, `account_modules`.

- **Given** el sistema actual de Jedami,
  **When** se aplica la migración seed,
  **Then** existe `tenants.id = 1` con `slug = 'jedami'` y `accounts.id = 1` con `slug = 'jedami'` bajo ese tenant.

- **Given** los planes definidos,
  **When** se consulta `plans`,
  **Then** existen los planes `free`, `basic`, `pro` con sus `features` JSONB.

**Tareas técnicas:**

- [ ] Migration `044_plans.sql`:
  ```sql
  CREATE TABLE plans (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(50)   NOT NULL UNIQUE,
    price          NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency       VARCHAR(3)    NOT NULL DEFAULT 'ARS',
    frequency      INT           NOT NULL DEFAULT 1,
    frequency_type VARCHAR(10)   NOT NULL DEFAULT 'months',
    max_accounts   INT           NOT NULL DEFAULT 1,
    max_products   INT           NOT NULL DEFAULT 10,
    max_users      INT           NOT NULL DEFAULT 2,
    features       JSONB         NOT NULL DEFAULT '{}',
    active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  );
  ```

- [ ] Migration `045_tenants.sql`:
  ```sql
  CREATE TABLE tenants (
    id                   SERIAL PRIMARY KEY,
    slug                 VARCHAR(100) UNIQUE NOT NULL,
    name                 VARCHAR(255)        NOT NULL,
    plan_id              INT                 REFERENCES plans(id),
    subscription_status  VARCHAR(20)         NOT NULL DEFAULT 'free'
      CHECK (subscription_status IN ('free', 'pending', 'authorized', 'paused', 'cancelled')),
    mp_subscription_id   VARCHAR(100),
    mp_payer_email       VARCHAR(255),
    created_at           TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ         NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_tenants_slug ON tenants(slug);

  CREATE TABLE subscription_payments (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INT          NOT NULL REFERENCES tenants(id),
    mp_payment_id       VARCHAR(100),
    mp_subscription_id  VARCHAR(100),
    amount              NUMERIC(10,2),
    status              VARCHAR(30),
    event_type          VARCHAR(50),
    raw_data            JSONB,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_subscription_payments_tenant ON subscription_payments(tenant_id);
  ```

- [ ] Migration `046_accounts.sql`:
  ```sql
  CREATE TABLE accounts (
    id          SERIAL PRIMARY KEY,
    tenant_id   INT          NOT NULL REFERENCES tenants(id),
    slug        VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_accounts_slug      ON accounts(slug);
  CREATE INDEX idx_accounts_tenant_id ON accounts(tenant_id);

  CREATE TABLE account_modules (
    account_id  INT         NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    module      VARCHAR(50) NOT NULL,
    enabled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account_id, module)
  );
  ```

- [ ] Migration `047_seed_plans_tenant_account.sql`:
  ```sql
  INSERT INTO plans (name, price, max_accounts, max_products, max_users, features) VALUES
    ('free',  0,   1,   10,   2,  '{"checkout_api": false, "point": false, "reports": false}'),
    ('basic', 0,   3,   100,  5,  '{"checkout_api": true,  "point": false, "reports": false}'),
    ('pro',   0,   999, 9999, 99, '{"checkout_api": true,  "point": true,  "reports": true}');

  INSERT INTO tenants (id, slug, name, plan_id, subscription_status)
  VALUES (1, 'jedami', 'Jedami', (SELECT id FROM plans WHERE name = 'pro'), 'authorized');

  INSERT INTO accounts (id, tenant_id, slug, name, active)
  VALUES (1, 1, 'jedami', 'Jedami', TRUE);

  INSERT INTO account_modules (account_id, module)
  VALUES (1, 'clothing');
  ```

---

### Story 12-2: account_id en tablas existentes

**Como** desarrollador,
**quiero** agregar `account_id` a todas las tablas operativas,
**para** aislar completamente los datos entre accounts.

**Criterios de aceptación:**

- **Given** la migración aplicada,
  **When** se consultan datos existentes,
  **Then** todos los registros tienen `account_id = 1`.

- **Given** dos accounts con productos distintos,
  **When** se consultan los productos de cada una,
  **Then** cada account solo ve sus propios productos.

**Tareas técnicas:**

- [ ] Migration `048_account_id_users.sql`:
  ```sql
  ALTER TABLE users ADD COLUMN tenant_id  INT REFERENCES tenants(id);
  ALTER TABLE users ADD COLUMN account_id INT REFERENCES accounts(id);
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
  ALTER TABLE users ADD CONSTRAINT uq_users_account_email UNIQUE (account_id, email);
  ```

- [ ] Migration `049_account_id_all_tables.sql`:
  ```sql
  ALTER TABLE products     ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE categories   ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE variants     ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE product_images ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE product_prices ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE sizes         ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE colors        ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE price_modes   ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE customers     ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE orders        ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE order_items   ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE payments      ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE payment_gateway_rules ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE purchase_types        ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE customer_types        ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE quantity_discount_rules ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE curva_discount_rules    ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE pos_devices          ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE pos_payment_intents  ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE branding             ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE banners              ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE announcements        ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE stock                ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
  ALTER TABLE stock_adjustments    ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);

  CREATE INDEX idx_products_account   ON products(account_id);
  CREATE INDEX idx_categories_account ON categories(account_id);
  CREATE INDEX idx_orders_account     ON orders(account_id);
  CREATE INDEX idx_payments_account   ON payments(account_id);
  CREATE INDEX idx_customers_account  ON customers(account_id);
  CREATE INDEX idx_variants_account   ON variants(account_id);
  CREATE INDEX idx_branding_account   ON branding(account_id);

  ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
  ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;
  ALTER TABLE categories ADD CONSTRAINT uq_categories_account_name UNIQUE (account_id, name);
  ALTER TABLE categories ADD CONSTRAINT uq_categories_account_slug UNIQUE (account_id, slug);

  ALTER TABLE sizes  DROP CONSTRAINT IF EXISTS sizes_label_key;
  ALTER TABLE sizes  ADD CONSTRAINT uq_sizes_account_label UNIQUE (account_id, label);

  ALTER TABLE colors DROP CONSTRAINT IF EXISTS colors_name_key;
  ALTER TABLE colors ADD CONSTRAINT uq_colors_account_name UNIQUE (account_id, name);

  ALTER TABLE payment_gateway_rules DROP CONSTRAINT IF EXISTS payment_gateway_rules_customer_type_gateway_key;
  ALTER TABLE payment_gateway_rules ADD CONSTRAINT uq_pgr_account_ct_gw UNIQUE (account_id, customer_type, gateway);
  ```

- [ ] Migration `050_new_roles.sql`:
  ```sql
  INSERT INTO roles (name) VALUES
    ('superadmin'),
    ('tenant_owner'),
    ('account_operator')
  ON CONFLICT (name) DO NOTHING;

  UPDATE roles SET name = 'account_admin' WHERE name = 'admin';
  ```

---

### Story 12-3: Middleware resolveAccount + queries con account_id

**Como** desarrollador,
**quiero** que cada request identifique automáticamente a qué account pertenece y que todas las queries filtren por `account_id`,
**para** que nunca se mezclen datos entre accounts.

**Criterios de aceptación:**

- **Given** un request con header `X-Account-Slug: jedami` (desarrollo),
  **When** el middleware corre,
  **Then** `req.accountId = 1` y `req.tenantId = 1` están disponibles para los handlers.

- **Given** un request con slug desconocido,
  **When** el middleware corre,
  **Then** responde 404 "Account no encontrada".

- **Given** dos accounts distintas,
  **When** cada una consulta `GET /api/v1/products`,
  **Then** cada una solo ve sus propios productos.

**Tareas técnicas:**

- [ ] Crear `src/middleware/account.middleware.ts` con `resolveAccount`:
  ```typescript
  export async function resolveAccount(req, res, next) {
    const slug = req.hostname.split('.')[0] ?? req.headers['x-account-slug'];
    const result = await pool.query(
      `SELECT a.id AS account_id, a.tenant_id,
              p.features, p.name AS plan_name
       FROM accounts a
       JOIN tenants t ON t.id = a.tenant_id
       JOIN plans p   ON p.id = t.plan_id
       WHERE a.slug = $1 AND a.active = TRUE`,
      [slug],
    );
    const account = result.rows[0];
    if (!account) return res.status(404).json({ error: 'Account no encontrada' });
    req.accountId       = account.account_id;
    req.tenantId        = account.tenant_id;
    req.accountPlan     = account.plan_name;
    req.accountFeatures = account.features ?? {};
    next();
  }
  ```
- [ ] Registrar `resolveAccount` como middleware global en `app.ts` para todas las rutas `/api/v1/`
- [ ] Actualizar **todos los repositories y queries** para agregar `AND account_id = $N`:
  - `products`, `orders`, `customers`, `payments`, `users`
  - `config` (branding, purchase_types, customer_types, sizes, colors, price_modes)
  - `banners`, `announcements`, `pos`, `discounts`
- [ ] JWT payload: `{ userId, tenantId, accountId, roles }`
- [ ] `authMiddleware` valida que `token.accountId === req.accountId`

---

### Story 12-4: Guard de features por plan

**Como** desarrollador,
**quiero** bloquear el acceso a funcionalidades premium según el plan del tenant,
**para** hacer cumplir los límites de cada plan.

**Criterios de aceptación:**

- **Given** endpoint protegido con `requireFeature('point')`,
  **When** lo llama una account con plan `free`,
  **Then** responde 403 con `{ upgrade: true, feature: 'point' }`.

**Tareas técnicas:**

- [ ] Crear `src/middleware/plan-guard.middleware.ts` con `requireFeature(feature: string)`
- [ ] Aplicar en: `/admin/pos/` (`point`), descuentos (`discount_rules`), Checkout API (`checkout_api`)

---

## FASE 2 — Billing del SaaS

---

### Story 12-5: Suscripción de Tenant vía MP PreApproval

**Como** dueño de un tenant,
**quiero** elegir un plan y pagar la suscripción mensual,
**para** tener mis accounts activas en la plataforma.

**Flujo:**
```
POST /api/saas/subscribe { planId, payerEmail }
  → Crea PreApproval en MP (auto_recurring mensual)
  → Guarda mp_subscription_id en tenants
  → Devuelve { checkoutUrl }
  → Tenant owner paga en MP
  → MP webhookea POST /api/saas/webhook
  → tenants.subscription_status = 'authorized'
```

**Tareas técnicas:**
- [ ] Módulo `src/modules/saas/` con `saas.service.ts`, `saas.controller.ts`, `saas.routes.ts`
- [ ] Rutas montadas en `/api/saas/` — sin `resolveAccount` (son rutas de la plataforma)
- [ ] `external_reference` del PreApproval = `tenantId`
- [ ] Endpoints: `POST /subscribe`, `POST /webhook`, `DELETE /subscribe`, `GET /subscription`

---

### Story 12-6: Guard de suscripción activa

**Como** sistema,
**quiero** bloquear operaciones cuando el tenant tiene la suscripción pausada o cancelada,
**para** que solo las accounts de tenants activos puedan operar.

**Tareas técnicas:**
- [ ] Middleware `requireActiveTenant` — verifica `subscription_status` del tenant de la account
- [ ] `paused` → catálogo visible (GET), bloquea escrituras (pedidos, pagos)
- [ ] `cancelled` → bloqueo total

---

## FASE 3 — Onboarding

---

### Story 12-7: Registro de nuevo Tenant + primera Account

**Como** nuevo cliente,
**quiero** registrar mi tenant en Jedami y crear mi primera account,
**para** empezar a vender.

**Flujo:**
```
POST /api/saas/register { tenantName, tenantSlug, accountName, accountSlug, ownerEmail, ownerPassword, planId }
  → Crea tenant
  → Crea account bajo el tenant
  → Crea usuario con rol tenant_owner (tenant_id set, account_id null)
  → Crea usuario con rol account_admin para la primera account
  → Activa módulo clothing en la account
  → Seed de branding, purchase_types, customer_types, sizes, colors por defecto
  → Si plan pago → inicia flujo MP PreApproval
```

---

### Story web-12-1: UI de registro (onboarding)

**Pantallas:**
1. `/registro` — nombre del tenant, slug del tenant, email, contraseña, plan
2. `/registro/account` — nombre y slug de la primera account (con preview `{slug}.jedamiapp.com`)
3. Selector de plan con comparativa Free / Basic / Pro
4. Si plan pago → redirect a MP
5. `/bienvenida` con checklist de primeros pasos

---

### Story web-12-2: Panel superadmin

**Como** Marceloo (dueño del SaaS),
**quiero** un panel para ver y gestionar todos los tenants y sus accounts.

**Pantallas:**
- `/superadmin/tenants` — tabla: tenant, plan, status, accounts activas, MRR
- `/superadmin/tenants/:slug/accounts` — accounts del tenant
- Acciones: pausar/reactivar tenant, cambiar plan (promo)

---

### Story web-12-3: Panel de suscripción del tenant owner

**Pantallas:**
- `/tenant/suscripcion` — plan activo, próximo cobro, historial de pagos
- `/tenant/accounts` — lista de accounts del tenant, crear nueva account

---

## Consideraciones de arquitectura

### JWT multi-tenant
```typescript
// Superadmin (plataforma):
{ userId: 1, roles: ['superadmin'] }

// Tenant owner (ve todas las accounts del tenant):
{ userId: 2, tenantId: 1, roles: ['tenant_owner'] }

// Account admin / operator (scoped a una account):
{ userId: 3, tenantId: 1, accountId: 1, roles: ['account_admin'] }

// Comprador:
{ userId: 4, accountId: 1, roles: ['wholesale'] }
```

### Redis — claves por account
```
# Antes (single-tenant):
config:all

# Después (multi-tenant):
account:{accountId}:config
account:{accountId}:catalog:*
tenant:{tenantSlug}:meta
```

### Unicidades que cambian de global a por-account
| Tabla | Constraint anterior | Nuevo constraint |
|-------|--------------------|--------------------|
| `users` | `UNIQUE(email)` | `UNIQUE(account_id, email)` |
| `categories` | `UNIQUE(name)`, `UNIQUE(slug)` | `UNIQUE(account_id, name/slug)` |
| `sizes` | `UNIQUE(label)` | `UNIQUE(account_id, label)` |
| `colors` | `UNIQUE(name)` | `UNIQUE(account_id, name)` |
| `payment_gateway_rules` | `UNIQUE(customer_type, gateway)` | `UNIQUE(account_id, customer_type, gateway)` |

---

## Resumen de stories y migraciones

| Story | Track | Fase | Migraciones | Estado |
|-------|-------|------|-------------|--------|
| 12-1 | BFF | 1 | 044–047 | backlog |
| 12-2 | BFF | 1 | 048–050 | backlog |
| 12-3 | BFF | 1 | solo código | backlog |
| 12-4 | BFF | 1 | solo código | backlog |
| 12-5 | BFF | 2 | solo código | backlog |
| 12-6 | BFF | 2 | solo código | backlog |
| 12-7 | BFF | 3 | solo código | backlog |
| web-12-1 | WEB | 3 | — | backlog |
| web-12-2 | WEB | 3 | — | backlog |
| web-12-3 | WEB | 3 | — | backlog |
