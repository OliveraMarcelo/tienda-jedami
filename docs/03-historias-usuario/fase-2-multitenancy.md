---
fase: 2
titulo: "Conversión a Plataforma SaaS Multitenant"
estado: "en-definicion"
fecha: "2026-05-01"
autor: "Marceloo"
referencias:
  - docs/06-arquitectura/multitenant.md
  - docs/multitenant/02-modelo-multitenancy.md
---

# Fase 2 — Conversión a Plataforma SaaS Multitenant

## Visión

Jedami evoluciona de una tienda single-tenant a una **plataforma SaaS multitenant** basada en
el modelo **Tenant → Account**:

- Un **Tenant** es quien contrata y paga el SaaS (MarceDev, Clara, Don Lucho).
- Una **Account** es cada tienda/negocio dentro de un Tenant (jedami, ferretería-don-lucho).
- El billing vive en el Tenant. La operación diaria vive en la Account.

Hay dos capas de negocio diferenciadas:
- **Capa SaaS:** Marceloo cobra suscripción mensual a cada Tenant vía MP PreApproval.
- **Capa Account:** Cada Account cobra a sus compradores vía MP Checkout Pro/API.

## Estado Actual del Proyecto

El proyecto `tienda-jedami` tiene implementado:
- Auth JWT (registro, login, roles, RBAC)
- Módulo de productos con variantes (clothing: talles + colores)
- Catálogo público con precios minorista/mayorista
- Pedidos con modalidad curva y cantidad
- Pagos vía Mercado Pago Checkout Pro
- Stack: Express 5 + pg + JWT | Vue 3 + Pinia | Flutter + Riverpod

Todo funciona para **un único tenant/account hardcoded**. El objetivo de esta fase es
escalar ese mismo sistema para N tenants y N accounts.

---

## EP-06 — Fundación Multitenant (prerequisito bloqueante)

> Sin este epic, nada del resto puede funcionar. Debe implementarse completo antes de avanzar.

### HU-11 — Migraciones de tablas core: plans, tenants, accounts

Como desarrollador,
quiero crear las tablas `plans`, `tenants`, `subscription_payments`, `accounts` y `account_modules`,
para tener la base de datos del modelo Tenant → Account.

**Criterios de aceptación:**
- [ ] Migración `044` crea tabla `plans` con `max_accounts`, `max_products`, `max_users`, `features JSONB`
- [ ] Migración `045` crea tabla `tenants` con `slug` UNIQUE, `plan_id`, `subscription_status` (CHECK), `mp_subscription_id`
- [ ] Migración `045` crea tabla `subscription_payments` con FK a `tenants`
- [ ] Migración `046` crea tabla `accounts` con FK a `tenants`, `slug` UNIQUE
- [ ] Migración `046` crea tabla `account_modules` con PK compuesta `(account_id, module)`
- [ ] Migración `047` seed: plan `pro`, `tenants.id = 1` slug `jedami`, `accounts.id = 1` slug `jedami` con módulo `clothing`
- [ ] Índices creados: `idx_tenants_slug`, `idx_accounts_slug`, `idx_accounts_tenant_id`

---

### HU-12 — Agregar account_id a todas las tablas operativas

Como desarrollador,
quiero agregar `account_id` a todas las tablas existentes,
para aislar la data entre accounts desde el nivel de base de datos.

**Criterios de aceptación:**
- [ ] Migración `048` agrega `tenant_id` y `account_id` a `users` con constraint `UNIQUE(account_id, email)`
- [ ] Migración `049` agrega `account_id INT NOT NULL DEFAULT 1` a: `products`, `categories`, `variants`, `product_images`, `product_prices`, `sizes`, `colors`, `price_modes`, `customers`, `orders`, `order_items`, `payments`, `payment_gateway_rules`, `purchase_types`, `customer_types`, `quantity_discount_rules`, `curva_discount_rules`, `pos_devices`, `pos_payment_intents`, `branding`, `banners`, `announcements`, `stock`, `stock_adjustments`
- [ ] Migración `050` agrega roles `superadmin`, `tenant_owner`, `account_operator` y renombra `admin` → `account_admin`
- [ ] Índices de performance creados: `idx_products_account`, `idx_orders_account`, `idx_payments_account`, `idx_customers_account`
- [ ] Constraints globales actualizados a por-account: `sizes`, `colors`, `categories`, `payment_gateway_rules`
- [ ] El account `id = 1` tiene todos los datos existentes — no se pierde nada

---

### HU-13 — Middleware resolveAccount

Como sistema,
quiero identificar la account en cada request HTTP,
para saber qué datos servir y qué features están habilitadas.

**Criterios de aceptación:**
- [ ] Middleware `resolveAccount` extrae el slug del request (subdominio en producción, header `X-Account-Slug` en desarrollo)
- [ ] Query: `SELECT a.id, a.tenant_id, p.features, p.name FROM accounts a JOIN tenants t ON t.id = a.tenant_id JOIN plans p ON p.id = t.plan_id WHERE a.slug = $1 AND a.active = TRUE`
- [ ] Agrega al request: `req.accountId`, `req.tenantId`, `req.accountPlan`, `req.accountFeatures`
- [ ] Devuelve 404 si el slug no existe o la account está inactiva
- [ ] Devuelve 503 si `tenants.subscription_status` es `paused` o `cancelled`
- [ ] Tipos TypeScript declarados en `Express.Request` global

---

### HU-14 — JWT multi-tenant

Como sistema,
quiero incluir `tenantId` y `accountId` en el payload del JWT,
para validar que el usuario pertenece a la account correcta en cada request.

**Criterios de aceptación:**
- [ ] Payload JWT actualizado: `{ userId, tenantId, accountId, roles: string[] }`
- [ ] Al login, el `accountId` se resuelve del account activo del request (`req.accountId`)
- [ ] `authMiddleware` valida que `token.accountId === req.accountId`
- [ ] Tenant owner (`tenant_owner`) tiene `tenantId` en el token pero `accountId = null`
- [ ] Superadmin tiene solo `roles: ['superadmin']`, sin `tenantId` ni `accountId`

---

### HU-15 — Guard de features por plan

Como sistema,
quiero bloquear el acceso a funcionalidades premium según el plan del tenant,
para hacer cumplir los límites de cada plan.

**Criterios de aceptación:**
- [ ] Middleware `requireFeature(feature)` verifica `req.accountFeatures[feature] === true`
- [ ] Responde 403 con `{ error, feature, upgrade: true }` si la feature no está habilitada
- [ ] Aplicado en: `checkout_api`, `point`, `reports`, `custom_domain`, `discount_rules`

---

## EP-07 — Billing del SaaS (MP PreApproval)

### HU-16 — Suscripción de Tenant vía MP PreApproval

Como dueño de un Tenant,
quiero suscribirme a un plan de Jedami pagando mensualmente vía Mercado Pago,
para activar mis accounts en la plataforma.

**Criterios de aceptación:**
- [ ] `POST /api/saas/subscribe` recibe `{ planId, payerEmail }` y devuelve `{ checkoutUrl, subscriptionId }`
- [ ] Backend crea PreApproval en MP con `auto_recurring` mensual y precio del plan
- [ ] `external_reference` = `tenantId` para identificar el tenant en el webhook
- [ ] `tenants.subscription_status` actualizado a `pending` en DB
- [ ] `GET /api/saas/plans` devuelve planes activos con precios y features (público)

---

### HU-17 — Webhook de suscripciones del SaaS

Como sistema,
quiero recibir notificaciones de MP sobre el estado de las suscripciones,
para activar, pausar o cancelar tenants automáticamente.

**Criterios de aceptación:**
- [ ] `POST /api/saas/webhook` procesa eventos `subscription_preapproval` de MP
- [ ] Mapea estados MP → `tenants.subscription_status` (`authorized`, `paused`, `cancelled`, `pending`)
- [ ] Inserta registro en `subscription_payments` por cada evento
- [ ] Responde 200 siempre (evita reintentos infinitos de MP)
- [ ] Endpoint diferente al webhook de pagos del account (`POST /api/v1/payments/webhook`)

---

### HU-18 — Cancelación de suscripción

Como dueño de un Tenant,
quiero cancelar mi suscripción desde el panel,
para dejar de ser cobrado.

**Criterios de aceptación:**
- [ ] `POST /api/saas/cancel` cancela el PreApproval en MP y actualiza `subscription_status = 'cancelled'`
- [ ] Todas las accounts del tenant quedan bloqueadas (read-only 30 días)
- [ ] Log en `subscription_payments`

---

## EP-08 — Onboarding de Nuevos Tenants

### HU-19 — Registro de nuevo Tenant y primera Account

Como dueño de un negocio,
quiero registrar mi tenant en Jedami y crear mi primera account,
para tener mi propio espacio aislado en la plataforma.

**Criterios de aceptación:**
- [ ] `POST /api/saas/register` recibe `{ tenantName, tenantSlug, accountName, accountSlug, ownerEmail, ownerPassword, planId }`
- [ ] Transacción atómica: crea `tenant` → `account` → usuario `tenant_owner` → usuario `account_admin` → `account_modules` → seed (branding, config, sizes, colors)
- [ ] Si plan pago → devuelve `checkoutUrl` de MP
- [ ] Valida unicidad de `tenantSlug` y `accountSlug` globalmente

---

### HU-20 — Panel de superadmin

Como Marceloo (dueño del SaaS),
quiero un panel para gestionar todos los Tenants y sus Accounts,
para supervisar la plataforma.

**Criterios de aceptación:**
- [ ] `GET /api/platform/tenants` — lista todos los tenants con plan, status, cantidad de accounts, último pago
- [ ] `GET /api/platform/tenants/:slug/accounts` — lista accounts de un tenant
- [ ] `PATCH /api/platform/tenants/:slug` — cambia `subscription_status` manualmente
- [ ] Protegidos por rol `superadmin`

---

## EP-09 — Redis Multi-Tenant

### HU-21 — Namespace de caché por account

Como sistema,
quiero que todas las claves de Redis incluyan el `accountId`,
para evitar colisiones de caché entre accounts.

**Criterios de aceptación:**
- [ ] Claves Redis migradas al formato `account:{accountId}:{resource}:{id}`
- [ ] Helper `cacheKey(accountId, resource, id?)` centraliza la construcción de claves
- [ ] Tests verifican que el caché de account A no contamina al account B

---

## Hoja de Ruta de Implementación

```
Sprint 1 — Fundación (EP-06)
  HU-11 → HU-12 → HU-13 → HU-14 → HU-15
  Resultado: sistema funciona para account_id=1, listo para N tenants/accounts

Sprint 2 — Billing SaaS (EP-07)
  HU-16 → HU-17 → HU-18
  Resultado: se puede cobrar suscripción mensual a tenants nuevos

Sprint 3 — Onboarding + Superadmin (EP-08)
  HU-19 → HU-20
  Resultado: cualquier negocio puede abrir su tenant/account sin intervención manual

Sprint 4 — Redis Multi-Tenant (EP-09)
  HU-21
  Resultado: Redis correctamente aislado por account

Sprint 5+ — Módulos verticales (EP-10)
  hardware / grocery / restaurant según demanda
```

## Decisiones Técnicas

| Decisión | Valor elegido | Alternativa descartada | Razón |
|---|---|---|---|
| Modelo de jerarquía | Tenant → Account | Flat (un solo nivel) | Permite que un cliente gestione varias tiendas |
| Aislamiento de datos | `WHERE account_id = $id` en cada query | PostgreSQL RLS | RLS agrega complejidad con pg Pool; se puede agregar en Fase 2 como segunda línea |
| Resolución de account | Header `X-Account-Slug` (dev) / subdominio (prod) | Path prefix | URLs limpias, compatible con DNS wildcard |
| Billing | A nivel Tenant (cubre todas sus accounts) | Por account | Más simple — una suscripción = todas las tiendas del cliente |
| JWT | `{ tenantId, accountId }` | Solo `accountId` | Permite al tenant_owner operar sin account activa |
| Plan Free | Sin límite de tiempo, con límites de features | Trial de N días | Reduce fricción de onboarding |

## Reglas de Negocio

| ID | Regla |
|---|---|
| RN-MT-01 | Un usuario solo pertenece a una account — no puede tener cuenta en dos accounts con el mismo email |
| RN-MT-02 | El `slug` del tenant y de la account son inmutables una vez creados |
| RN-MT-03 | Tenants con `paused` no pueden generar pedidos pero sí ver historial |
| RN-MT-04 | Tenants con `cancelled` tienen 30 días de acceso de solo lectura |
| RN-MT-05 | El módulo `clothing` está siempre activo — es el módulo base del sistema actual |
| RN-MT-06 | El superadmin no pertenece a ningún tenant — tiene acceso transversal a toda la plataforma |
| RN-MT-07 | El billing de un tenant cubre todas sus accounts — no hay billing por account separado |
| RN-MT-08 | Las credenciales MP de las accounts son las del dueño del SaaS en la primera fase |
