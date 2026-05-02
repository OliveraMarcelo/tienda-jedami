# Arquitectura Multi-Tenant — Jedami como SaaS

## Visión

Jedami es una plataforma SaaS donde vos (Marceloo) sos el dueño de la plataforma.
Tus clientes contratan el SaaS como **Tenants** y dentro de cada tenant gestionan
una o más **Accounts** (tiendas / negocios).

```
PLATAFORMA JEDAMI (Marceloo — superadmin)
│
├── Tenant: MarceDev
│     ├── Account: jedami
│     └── Account: jedami-mayorista
│
├── Tenant: Indumentaria Clara
│     └── Account: indumentaria-clara
│
└── Tenant: Ferretería Don Lucho
      └── Account: ferreteria-don-lucho
```

---

## Jerarquía de roles

| Rol | Nivel | Qué puede hacer |
|-----|-------|-----------------|
| `superadmin` | Plataforma | Ve y administra todos los tenants y accounts |
| `tenant_owner` | Tenant | Crea/elimina accounts, ve métricas de todas sus accounts, gestiona el billing |
| `account_admin` | Account | Administración completa de una account (rol actual `admin`) |
| `account_operator` | Account | Despacho, stock, pedidos — sin acceso a configuración ni pagos |
| `wholesale` | Account | Comprador mayorista de la account |
| `retail` | Account | Comprador minorista de la account |

> `wholesale` y `retail` son roles de compradores, no de staff. Se mantienen igual que hoy.

---

## Modelo de datos

### Diagrama de capas

```
plans
  └── tenants                ← quien paga el SaaS (MarceDev, Clara, Don Lucho)
        ├── subscription_payments
        └── accounts         ← cada tienda / negocio
              ├── account_modules
              └── [todas las tablas del negocio con account_id]
                    users, products, categories, customers,
                    orders, payments, branding, banners, etc.
```

---

### Tablas nuevas

```sql
-- ─── 044: Planes del SaaS ──────────────────────────────────────────────────────
CREATE TABLE plans (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(50)   NOT NULL,           -- 'free', 'basic', 'pro'
  price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency       VARCHAR(3)    NOT NULL DEFAULT 'ARS',
  frequency      INT           NOT NULL DEFAULT 1,
  frequency_type VARCHAR(10)   NOT NULL DEFAULT 'months',
  max_accounts   INT           NOT NULL DEFAULT 1,  -- accounts por tenant
  max_products   INT           NOT NULL DEFAULT 10,
  max_users      INT           NOT NULL DEFAULT 2,
  features       JSONB         NOT NULL DEFAULT '{}',
  -- Ej: {"checkout_api": true, "point": false, "reports": false, "custom_domain": false}
  active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── 045: Tenants (quien compra el SaaS) ──────────────────────────────────────
CREATE TABLE tenants (
  id                   SERIAL PRIMARY KEY,
  slug                 VARCHAR(100) UNIQUE NOT NULL,  -- 'marcedev', 'ferreteria-don-lucho'
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

-- ─── 046: Historial de pagos del SaaS ─────────────────────────────────────────
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

-- ─── 047: Accounts (tiendas / negocios dentro de un tenant) ───────────────────
CREATE TABLE accounts (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT          NOT NULL REFERENCES tenants(id),
  slug        VARCHAR(100) UNIQUE NOT NULL,   -- 'jedami', 'ferreteria-don-lucho'
  name        VARCHAR(255) NOT NULL,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_slug      ON accounts(slug);
CREATE INDEX idx_accounts_tenant_id ON accounts(tenant_id);

-- ─── 048: Módulos activos por account ─────────────────────────────────────────
CREATE TABLE account_modules (
  account_id  INT         NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  module      VARCHAR(50) NOT NULL,
  -- 'clothing' | 'hardware' | 'grocery' | 'restaurant'
  enabled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, module)
);
```

---

### Cambios en tablas existentes

```sql
-- ─── 049: Agregar tenant_id y account_id a users ──────────────────────────────
-- tenant_id  → usuario de nivel tenant (tenant_owner, ve todas las accounts)
-- account_id → usuario de nivel account (account_admin, operator, wholesale, retail)
-- ambos NULL → superadmin (plataforma)

ALTER TABLE users ADD COLUMN tenant_id  INT REFERENCES tenants(id);
ALTER TABLE users ADD COLUMN account_id INT REFERENCES accounts(id);

-- Un email puede existir en distintas accounts sin conflicto
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ADD CONSTRAINT uq_users_account_email
  UNIQUE (account_id, email);

-- ─── 050: account_id en tablas del negocio ────────────────────────────────────
-- DEFAULT 1 para no romper datos actuales (account inicial = 1)

ALTER TABLE products    ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
ALTER TABLE categories  ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
ALTER TABLE customers   ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
ALTER TABLE orders      ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
ALTER TABLE payments    ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
ALTER TABLE branding    ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
ALTER TABLE banners     ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
ALTER TABLE announcements        ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
ALTER TABLE pos_devices          ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);
ALTER TABLE payment_gateway_rules ADD COLUMN account_id INT NOT NULL DEFAULT 1 REFERENCES accounts(id);

CREATE INDEX idx_products_account   ON products(account_id);
CREATE INDEX idx_categories_account ON categories(account_id);
CREATE INDEX idx_customers_account  ON customers(account_id);
CREATE INDEX idx_orders_account     ON orders(account_id);
CREATE INDEX idx_payments_account   ON payments(account_id);

-- ─── 051: Nuevos roles de staff ───────────────────────────────────────────────
INSERT INTO roles (name) VALUES
  ('superadmin'),
  ('tenant_owner'),
  ('account_operator')
ON CONFLICT (name) DO NOTHING;

-- Renombrar rol existente 'admin' → 'account_admin'
UPDATE roles SET name = 'account_admin' WHERE name = 'admin';

-- ─── 052: Seed — tenant y account inicial para los datos actuales ──────────────
INSERT INTO plans (name, price, max_accounts, max_products, max_users, features)
VALUES
  ('free',  0, 1,   10,   2,  '{"checkout_api": false, "point": false, "reports": false}'),
  ('basic', 0, 3,   100,  5,  '{"checkout_api": true,  "point": false, "reports": false}'),
  ('pro',   0, 999, 9999, 99, '{"checkout_api": true,  "point": true,  "reports": true}');

INSERT INTO tenants (id, slug, name, plan_id, subscription_status)
VALUES (1, 'jedami', 'Jedami', 3, 'authorized');

INSERT INTO accounts (id, tenant_id, slug, name, active)
VALUES (1, 1, 'jedami', 'Jedami', TRUE);

INSERT INTO account_modules (account_id, module)
VALUES (1, 'clothing');
```

---

## JWT multi-tenant

```typescript
// Superadmin (Marceloo — acceso total):
{ userId: 1, roles: ['superadmin'] }

// Tenant owner (ve todas las accounts de su tenant):
{ userId: 2, tenantId: 1, roles: ['tenant_owner'] }

// Account admin / operator (scoped a una account):
{ userId: 3, tenantId: 1, accountId: 1, roles: ['account_admin'] }

// Comprador (wholesale o retail de la account):
{ userId: 4, accountId: 1, roles: ['wholesale'] }
```

---

## Middleware

### resolveAccount

Se ejecuta en todas las rutas `/api/v1/*`. Resuelve la account por subdominio.

```typescript
// jedami-bff/src/middleware/account.middleware.ts

declare global {
  namespace Express {
    interface Request {
      accountId:       number;
      tenantId:        number;
      accountPlan:     string;
      accountFeatures: Record<string, boolean>;
    }
  }
}

export async function resolveAccount(req: Request, res: Response, next: NextFunction) {
  // Producción: subdominio  → jedami.jedamiapp.com
  // Desarrollo: header      → X-Account-Slug: jedami
  const slug = req.hostname.split('.')[0] ?? req.headers['x-account-slug'] as string;

  if (!slug) return res.status(400).json({ error: 'Account no identificada' });

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

### requireFeature

```typescript
// jedami-bff/src/middleware/plan-guard.middleware.ts

export function requireFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.accountFeatures?.[feature]) {
      return res.status(403).json({
        error: `Tu plan "${req.accountPlan}" no incluye esta funcionalidad`,
        feature,
        upgrade: true,
      });
    }
    next();
  };
}
```

### requireRole

```typescript
// jedami-bff/src/middleware/role-guard.middleware.ts

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles: string[] = (req as any).user?.roles ?? [];
    const hasRole = roles.some(r => userRoles.includes(r));
    if (!hasRole) return res.status(403).json({ error: 'Acceso no autorizado' });
    next();
  };
}

// Uso:
// router.get('/tenants',  requireRole('superadmin'), listTenantsHandler)
// router.get('/accounts', requireRole('superadmin', 'tenant_owner'), listAccountsHandler)
// router.get('/products', requireRole('account_admin', 'account_operator'), listProductsHandler)
```

---

## Estructura de rutas

```
/api/platform/                  ← superadmin (Marceloo)
  GET  /tenants                 ← lista todos los tenants
  POST /tenants                 ← crea un tenant
  GET  /tenants/:slug/accounts  ← lista accounts de un tenant

/api/tenant/                    ← tenant_owner (requiere tenantId en JWT)
  GET  /accounts                ← sus accounts
  POST /accounts                ← crea una account dentro de su tenant
  GET  /billing                 ← estado de suscripción y pagos

/api/saas/                      ← billing del SaaS (MP PreApproval)
  POST /subscribe               ← inicia suscripción
  POST /webhook                 ← webhook MP PreApproval

/api/v1/                        ← operación de la account (requiere resolveAccount)
  /products, /orders, /customers, /payments, /config, etc.
```

---

## RLS — capa de seguridad adicional (Fase 2)

En Fase 1 cada query filtra con `WHERE account_id = $accountId` (desde el middleware).
En Fase 2 se agrega RLS como segunda línea de defensa — si una query olvida el WHERE,
PostgreSQL igual bloquea el acceso.

```sql
ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_isolation ON products
  USING (account_id = current_setting('app.account_id')::int);

-- El middleware inyecta el account_id al inicio de cada request:
await pool.query(`SET LOCAL app.account_id = $1`, [req.accountId]);
```

---

## Billing del SaaS — MP PreApproval (a nivel tenant)

El billing vive en el **tenant**. Una suscripción cubre todas las accounts del tenant.

```
Tenant owner elige plan en el panel
  → POST /api/saas/subscribe { planId, payerEmail }
  → Backend crea PreApproval en MP → devuelve init_point
  → Tenant owner completa el pago en MP
  → MP envía webhook → /api/saas/webhook
  → tenants.subscription_status = 'authorized'
  → Todas las accounts del tenant quedan activas
```

### Estados de suscripción

| Estado | Las accounts operan | El tenant_owner puede entrar |
|--------|---------------------|------------------------------|
| `free` | Sí (límites del plan free) | Sí |
| `pending` | Sí (grace period 24hs) | Sí |
| `authorized` | Sí | Sí |
| `paused` | No (compradores ven "servicio no disponible") | Sí (para reingresar tarjeta) |
| `cancelled` | No | Solo para reactivar |

---

## Planes sugeridos

| Plan | Precio/mes | Accounts | Productos | Features |
|------|-----------|----------|-----------|----------|
| Free | $0 | 1 | 10 | Solo Checkout Pro |
| Basic | $XX | 3 | 100 | + Checkout API |
| Pro | $XXX | ilimitadas | ilimitados | + Point + Reports + Dominio custom |

---

## Hoja de ruta de implementación

### Fase 1 — Fundación
1. Migraciones 044–052: plans, tenants, accounts, account_modules, subscription_payments
2. `account_id` en todas las tablas del core (DEFAULT 1 para datos actuales)
3. Nuevos roles: superadmin, tenant_owner, account_operator + renombrar admin → account_admin
4. Middleware `resolveAccount` + ajustar todas las queries con `WHERE account_id = $accountId`
5. JWT actualizado con `tenantId` + `accountId`
6. Seed: tenant + account inicial para los datos existentes de Jedami

### Fase 2 — Panel de gestión
7. Rutas `/api/platform/` para superadmin (vos)
8. Rutas `/api/tenant/` para tenant_owner (crear accounts, ver billing)
9. Vista de onboarding: crear tenant → elegir plan → crear primera account

### Fase 3 — Billing del SaaS
10. Módulo `saas/` con suscripciones via MP PreApproval
11. Webhook `/api/saas/webhook`
12. Guard `requireFeature()` en endpoints por plan

### Fase 4 — Seguridad avanzada
13. RLS en tablas críticas (products, orders, customers)
14. Límites de plan: max_products, max_accounts, max_users por tenant

### Fase 5 — Módulos verticales adicionales
15. `hardware`, `grocery`, `restaurant` según demanda real
