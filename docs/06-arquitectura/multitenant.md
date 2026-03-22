# Arquitectura Multi-Tenant — Jedami como SaaS

## Visión

Jedami es una **plataforma SaaS** que puede ser contratada por cualquier tipo de organización: una tienda de ropa, una ferretería, una empresa distribuidora, un almacén, un restaurante. El tipo de solución es una tienda online, pero el cliente puede ser cualquier tipo de negocio.

Cada organización que contrata la plataforma es un **tenant**. Cada tenant:
- Tiene su propio espacio aislado: catálogo, precios, pedidos, clientes y configuración.
- Paga una suscripción mensual para usar la plataforma.
- Activa los módulos verticales que necesita según su rubro (indumentaria, ferretería, almacén, etc.).
- Tiene su propio branding (logo, colores, nombre).

---

## Dos capas de negocio

```
┌──────────────────────────────────────────────────────────────────┐
│  PLATAFORMA JEDAMI (vos — el dueño del SaaS)                     │
│  Cobra suscripción mensual a cada tenant via MP PreApproval       │
└──────────────────────────────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │  Tenant A   │   │  Tenant B   │   │  Tenant C   │
   │  (empresa   │   │ (ferretería)│   │  (almacén)  │
   │  de ropa)   │   │             │   │             │
   │  Plan Pro   │   │  Plan Basic │   │  Plan Free  │
   └─────────────┘   └─────────────┘   └─────────────┘
         │                  │                  │
   Sus compradores    Sus compradores    Sus compradores
   pagan via          pagan via          pagan via
   MP Checkout        MP Checkout        MP Checkout
```

**Capa 1 — Billing del SaaS:** vos cobrás a cada tenant usando **MP PreApproval** (suscripción recurrente).

**Capa 2 — Pagos del tenant:** cada tenant cobra a sus compradores usando **MP Checkout Pro / Checkout API / Point** (flujos implementados en Epics 3, 10 y 11).

---

## Modelo de datos

### Tablas del core multi-tenant

```sql
-- ─── Planes del SaaS ─────────────────────────────────────────────────────────
CREATE TABLE plans (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(50)    NOT NULL,          -- 'free', 'basic', 'pro'
  price          NUMERIC(10,2)  NOT NULL,           -- precio mensual en ARS
  currency       VARCHAR(3)     DEFAULT 'ARS',
  frequency      INT            DEFAULT 1,          -- cada cuántos períodos
  frequency_type VARCHAR(10)    DEFAULT 'months',
  max_products   INT            DEFAULT 10,         -- límite por plan
  max_users      INT            DEFAULT 1,
  features       JSONB          DEFAULT '{}',
  -- Ej: {"checkout_api": true, "point": false, "reports": true, "custom_domain": false}
  active         BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ    DEFAULT NOW()
);

-- ─── Tenants (organizaciones que usan la plataforma) ─────────────────────────
-- "tenant" es neutral: puede ser una tienda, empresa, distribuidora, etc.
CREATE TABLE tenants (
  id                   SERIAL PRIMARY KEY,
  slug                 VARCHAR(100) UNIQUE NOT NULL,  -- identificador único: "empresa-abc"
  name                 VARCHAR(255)        NOT NULL,   -- nombre visible: "Empresa ABC"
  plan_id              INT REFERENCES plans(id),
  subscription_status  VARCHAR(20) DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'pending', 'authorized', 'paused', 'cancelled')),
  mp_subscription_id   VARCHAR(100),   -- ID en MP PreApproval API
  mp_payer_email       VARCHAR(255),
  created_at           TIMESTAMPTZ    DEFAULT NOW(),
  updated_at           TIMESTAMPTZ    DEFAULT NOW()
);

-- ─── Módulos activos por tenant ───────────────────────────────────────────────
CREATE TABLE tenant_modules (
  tenant_id   INT  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module      VARCHAR(50) NOT NULL,
  -- 'clothing' | 'hardware' | 'grocery' | 'restaurant'
  enabled_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, module)
);

-- ─── Historial de pagos del SaaS (auditoría de suscripciones) ─────────────────
CREATE TABLE subscription_payments (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT  NOT NULL REFERENCES tenants(id),
  mp_payment_id       VARCHAR(100),
  mp_subscription_id  VARCHAR(100),
  amount              NUMERIC(10,2),
  status              VARCHAR(30),
  event_type          VARCHAR(50),
  raw_data            JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de performance (críticos en multi-tenant)
CREATE INDEX idx_tenants_slug             ON tenants(slug);
CREATE INDEX idx_tenant_modules_tenant    ON tenant_modules(tenant_id);
CREATE INDEX idx_sub_payments_tenant      ON subscription_payments(tenant_id);
```

### tenant_id en todas las tablas del core

Todas las tablas que hoy existen agregan `tenant_id` para aislar la data entre tenants:

```sql
ALTER TABLE users       ADD COLUMN tenant_id INT NOT NULL REFERENCES tenants(id);
ALTER TABLE customers   ADD COLUMN tenant_id INT NOT NULL REFERENCES tenants(id);
ALTER TABLE products    ADD COLUMN tenant_id INT NOT NULL REFERENCES tenants(id);
ALTER TABLE categories  ADD COLUMN tenant_id INT NOT NULL REFERENCES tenants(id);
ALTER TABLE orders      ADD COLUMN tenant_id INT NOT NULL REFERENCES tenants(id);
ALTER TABLE payments    ADD COLUMN tenant_id INT NOT NULL REFERENCES tenants(id);
ALTER TABLE branding    ADD COLUMN tenant_id INT NOT NULL REFERENCES tenants(id);

-- Índices por tenant_id en las tablas más consultadas
CREATE INDEX idx_products_tenant  ON products(tenant_id);
CREATE INDEX idx_orders_tenant    ON orders(tenant_id);
CREATE INDEX idx_payments_tenant  ON payments(tenant_id);

-- UNIQUE email por tenant, no global
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ADD CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email);
```

### Tabla users multi-tenant

Un usuario pertenece a un tenant. No comparte cuenta entre tenants.

---

## Módulos verticales

Cada tenant activa los módulos que necesita. Los módulos definen qué tipo de productos y variantes maneja.

| Módulo | Rubro | Qué agrega |
|--------|-------|-----------|
| `clothing` | Indumentaria | Talles, colores, variantes, compra por curva y por cantidad |
| `hardware` | Ferretería / corralón | Atributos técnicos (medida, material), unidades de venta |
| `grocery` | Almacén / kiosco | Stock por peso/litro, vencimientos, proveedores |
| `restaurant` | Gastronomía | Secciones de menú, modificadores, mesas |

El módulo `clothing` es el que está implementado actualmente. Los demás son backlog.

---

## Resolución del tenant en cada request

Cada request HTTP necesita saber a qué tenant pertenece. Hay dos estrategias:

### Opción A — Por subdominio (recomendada para producción)
```
empresa-abc.jedami.com   →  tenant.slug = 'empresa-abc'
ferreteria-pepe.jedami.com  →  tenant.slug = 'ferreteria-pepe'
```

### Opción B — Por header (más simple para empezar)
```
X-Tenant-Slug: empresa-abc
```

### Implementación del middleware

```typescript
// src/middleware/tenant.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';

declare global {
  namespace Express {
    interface Request {
      tenantId:       number;
      tenantPlan:     string;
      tenantFeatures: Record<string, boolean>;
    }
  }
}

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  // Opción A: subdominio
  const host = req.hostname; // "empresa-abc.jedami.com"
  const slug = host.split('.')[0];

  // Opción B: header (fallback en desarrollo)
  // const slug = req.headers['x-tenant-slug'] as string;

  if (!slug) {
    return res.status(400).json({ error: 'Tenant no identificado' });
  }

  const result = await pool.query(
    `SELECT t.id, t.subscription_status, p.features, p.name AS plan_name
     FROM tenants t
     LEFT JOIN plans p ON p.id = t.plan_id
     WHERE t.slug = $1`,
    [slug],
  );

  const tenant = result.rows[0];
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant no encontrado' });
  }

  req.tenantId       = tenant.id;
  req.tenantPlan     = tenant.plan_name;
  req.tenantFeatures = tenant.features ?? {};

  next();
}
```

---

## Guard de plan (acceso por feature)

```typescript
// src/middleware/plan-guard.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function requireFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // subscription_status lo resuelve resolveTenant — no necesita otra query
    if (!req.tenantFeatures?.[feature]) {
      return res.status(403).json({
        error: `Tu plan "${req.tenantPlan}" no incluye esta funcionalidad`,
        feature,
        upgrade: true,
      });
    }
    next();
  };
}

// Uso en rutas:
// router.post('/process', requireFeature('checkout_api'), processPaymentHandler)
// router.post('/point/initiate', requireFeature('point'), initiatePointHandler)
```

---

## Billing del SaaS — MP PreApproval

El dueño del tenant se suscribe para pagar el plan mensual. Se usa la API **PreApproval** de MP — distinta a la API de pagos del tenant.

### Flujo de suscripción

```
Dueño del tenant → elige plan en el panel de Jedami
  → POST /api/saas/subscribe { planId }
  → Backend crea PreApproval en MP → devuelve init_point (URL de checkout)
  → Dueño completa el pago en MP
  → MP envía webhook a POST /api/saas/webhook
  → subscription_status = 'authorized'
  → El tenant queda activo
```

### Servicio de suscripción

```typescript
// src/modules/saas/saas.service.ts
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { pool } from '../../config/database.js';
import { ENV } from '../../config/env.js';

const mpClient = new MercadoPagoConfig({ accessToken: ENV.MP_ACCESS_TOKEN });
const preApproval = new PreApproval(mpClient);

export async function createSubscription(tenantId: number, payerEmail: string, planId: number) {
  const planRes = await pool.query('SELECT * FROM plans WHERE id = $1 AND active = TRUE', [planId]);
  const plan = planRes.rows[0];
  if (!plan) throw new Error('Plan no encontrado');

  const subscription = await preApproval.create({
    body: {
      back_url:           `${ENV.APP_URL}/panel/suscripcion/callback`,
      reason:             `Jedami — Plan ${plan.name}`,
      external_reference: String(tenantId),
      payer_email:        payerEmail,
      auto_recurring: {
        frequency:          plan.frequency,
        frequency_type:     plan.frequency_type,
        transaction_amount: Number(plan.price),
        currency_id:        plan.currency,
      },
      status: 'pending',
    },
  });

  await pool.query(
    `UPDATE tenants
     SET mp_subscription_id  = $1,
         mp_payer_email      = $2,
         plan_id             = $3,
         subscription_status = 'pending',
         updated_at          = NOW()
     WHERE id = $4`,
    [subscription.id, payerEmail, planId, tenantId],
  );

  return { subscriptionId: subscription.id, checkoutUrl: subscription.init_point };
}

export async function cancelSubscription(tenantId: number) {
  const res = await pool.query('SELECT mp_subscription_id FROM tenants WHERE id = $1', [tenantId]);
  const { mp_subscription_id } = res.rows[0];
  if (!mp_subscription_id) throw new Error('No hay suscripción activa');

  await preApproval.update({ id: mp_subscription_id, body: { status: 'cancelled' } });

  await pool.query(
    `UPDATE tenants SET subscription_status = 'cancelled', updated_at = NOW() WHERE id = $1`,
    [tenantId],
  );
}
```

### Webhook de suscripciones del SaaS

```typescript
// Endpoint: POST /api/saas/webhook
// DISTINTO al webhook de pagos del tenant (POST /api/v1/payments/webhook)

export async function handleSaasWebhook(body: { type: string; data: { id: string } }) {
  if (body.type !== 'subscription_preapproval') return;

  const subscription = await preApproval.get({ id: body.data.id });

  const statusMap: Record<string, string> = {
    authorized: 'authorized',
    paused:     'paused',
    cancelled:  'cancelled',
    pending:    'pending',
  };
  const newStatus = statusMap[subscription.status ?? ''] ?? 'unknown';

  // external_reference = tenant_id
  const tenantId = subscription.external_reference;

  await pool.query(
    `UPDATE tenants
     SET subscription_status = $1,
         mp_subscription_id  = $2,
         updated_at          = NOW()
     WHERE id = $3`,
    [newStatus, subscription.id, tenantId],
  );

  await pool.query(
    `INSERT INTO subscription_payments (tenant_id, mp_subscription_id, status, event_type, raw_data)
     VALUES ($1, $2, $3, $4, $5)`,
    [tenantId, subscription.id, newStatus, body.type, JSON.stringify(body)],
  );
}
```

---

## Estructura de rutas

```
/api/saas/           ← gestión de la plataforma (suscripciones, onboarding)
/api/saas/webhook    ← webhook de MP PreApproval (billing del SaaS)

/api/v1/             ← API del tenant (requiere resolveTenant middleware)
/api/v1/payments/webhook  ← webhook de pagos de compradores del tenant
```

---

## Estructura BFF multi-tenant

```
src/
├── middleware/
│   ├── auth.middleware.ts         ← JWT (incluye tenantId en el payload)
│   ├── tenant.middleware.ts       ← resolveTenant (agrega req.tenantId)
│   └── plan-guard.middleware.ts   ← requireFeature('point')
│
├── modules/
│   ├── saas/                      ← billing de la plataforma
│   │   ├── saas.controller.ts
│   │   ├── saas.service.ts        ← PreApproval MP
│   │   └── saas.routes.ts
│   │
│   ├── core/                      ← lógica del tenant (tenant_id en todas las queries)
│   │   ├── products/
│   │   ├── orders/
│   │   ├── payments/              ← Checkout Pro / API / Point
│   │   ├── auth/
│   │   └── config/
│   │
│   └── verticals/                 ← módulos activables por tenant
│       ├── clothing/              ← implementado actualmente
│       ├── hardware/              ← backlog
│       ├── grocery/               ← backlog
│       └── restaurant/            ← backlog
│
└── app.ts
```

### Registro dinámico de módulos verticales

```typescript
// app.ts — las rutas de módulos se registran según tenant_modules
const activeModules = await getTenantModules(tenantId);

if (activeModules.includes('clothing'))   app.use('/api/v1', clothingRoutes);
if (activeModules.includes('hardware'))   app.use('/api/v1', hardwareRoutes);
if (activeModules.includes('grocery'))    app.use('/api/v1', groceryRoutes);
if (activeModules.includes('restaurant')) app.use('/api/v1', restaurantRoutes);
```

---

## Planes sugeridos

| Plan | Precio/mes | Productos | Módulos | Features especiales |
|------|-----------|-----------|---------|---------------------|
| Free | $0 | 10 | clothing | Solo Checkout Pro |
| Basic | $X | 100 | clothing | Checkout Pro + API |
| Pro | $XX | ilimitados | todos | + Point + Reports + Dominio custom |

La columna `features` en `plans` controla exactamente qué puede usar cada plan:
```json
{
  "checkout_api":   true,
  "point":          false,
  "reports":        false,
  "custom_domain":  false,
  "discount_rules": true
}
```

---

## Comportamiento según estado de suscripción

| Estado | El tenant puede operar | El admin puede entrar |
|--------|----------------------|----------------------|
| `free` | Sí (con límites del plan free) | Sí |
| `pending` | Sí (grace period 24hs) | Sí |
| `authorized` | Sí | Sí |
| `paused` | No (compradores ven "servicio no disponible") | Sí (para reingresar tarjeta) |
| `cancelled` | No | Solo para reactivar |

---

## JWT multi-tenant

El token JWT incluye `tenantId` para que el middleware pueda validar que el usuario pertenece al tenant correcto:

```typescript
// Payload anterior (single-tenant):
{ userId: 1, roles: ['admin'] }

// Payload multi-tenant:
{ userId: 1, tenantId: 1, roles: ['admin'] }
```

---

## Redis y caché multi-tenant

Todas las claves de caché incluyen `tenantId` para evitar colisiones entre tenants:

```
catalog:{tenantId}:*           (antes: catalog:*)
product:{tenantId}:{id}        (antes: product:{id})
admin:{tenantId}:dashboard     (antes: admin:dashboard)
config:{tenantId}              (antes: config)
```

---

## Credenciales MP por tenant (fase futura)

Actualmente todos los tenants usan las credenciales MP del dueño de la plataforma. Si en el futuro cada tenant quiere usar sus propias credenciales MP (para que los pagos vayan directamente a su cuenta), se agrega `mp_access_token` en `tenants` y el cliente MP se construye por request en vez de uno global.

---

## Hoja de ruta de implementación

### Fase 1 — Fundación (prerequisito para todo lo demás)
1. Migraciones: tablas `plans`, `tenants`, `tenant_modules`, `subscription_payments`
2. Agregar `tenant_id` a todas las tablas del core (con `DEFAULT 1` para no romper datos actuales)
3. Middleware `resolveTenant` + ajustar todas las queries para filtrar por `tenant_id`
4. Migrar el tenant actual de Jedami como `tenant_id = 1` (seed)

### Fase 2 — Billing del SaaS
5. Módulo `saas/` con suscripciones via MP PreApproval
6. Webhook `/api/saas/webhook` para actualizar `subscription_status`
7. Middleware `requireFeature()` protegiendo endpoints por plan

### Fase 3 — Onboarding de nuevos tenants
8. Flujo de registro: nombre → slug → plan → checkout MP → tenant activo
9. Panel de administración de la plataforma (superadmin — para vos)

### Fase 4 — Módulos verticales adicionales
10. `module_hardware`, `module_grocery`, `module_restaurant` según demanda
