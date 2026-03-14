---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-10'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief.md
  - docs/06-arquitectura/arquitectura-general.md
  - docs/06-arquitectura/decisiones.md
  - docs/01-requerimientos/requerimientos.md
  - docs/00-glosario.md
workflowType: 'architecture'
project_name: 'tienda-jedami'
user_name: 'Marceloo'
date: '2026-03-10'
---

# Documento de Decisiones de Arquitectura

_Este documento se construye de forma colaborativa a través de un proceso de descubrimiento paso a paso. Las secciones se agregan a medida que tomamos cada decisión arquitectónica juntos._

---

## Análisis de Contexto del Proyecto

### Resumen de Requerimientos

**Requerimientos Funcionales (12 RFs principales):**

- **Autenticación e identidad:** RF-01 (registro), RF-02 (login/JWT), RF-03 (roles), RF-04 (asignación de roles), RF-05 (RBAC)
- **Catálogo:** RF-06 (CRUD de productos, solo admin), RF-07 (listado público con precios según modo de la tienda)
- **Ventas:** RF-08 (creación de pedidos), RF-09 (modalidades minorista/mayorista), RF-10/10.1/10.2/10.3 (tipos de compra mayorista)
- **Operaciones:** RF-11 (validación de stock), RF-12 (integración Mercado Pago)

**Requerimientos No Funcionales:**

- **Seguridad:** bcrypt (salt ≥ 10), expiración de JWT, middleware de rutas, validación de firma del webhook
- **Consistencia:** constraints FK en PostgreSQL, transacciones atómicas en stock + pedidos
- **Arquitectura:** capas separadas (API → Dominio → Infraestructura); módulo mayorista encapsulado e independiente
- **Escalabilidad:** principio Open/Closed; nuevos medios de pago sin modificar lógica de pedidos
- **Tiempo real:** infraestructura de eventos desacoplada, activable progresivamente por módulo

**Escala y Complejidad:**

- Dominio principal: API REST backend (patrón BFF, consumido por Vue web + Flutter mobile)
- Nivel de complejidad: **Medio-Alto**
- Módulos arquitectónicos estimados: **8–10**
- Roadmap de desarrollo: 5 fases (fundaciones → catálogo → mayorista → pedidos/pagos → operación)

### Restricciones Técnicas y Dependencias

| Restricción | Detalle |
|---|---|
| Lenguaje | Node.js + TypeScript (modo estricto) |
| Base de datos | PostgreSQL (relacional, FK enforced) |
| Protocolo | HTTP/JSON REST |
| Proveedor de pago | Mercado Pago (Fase 1 únicamente, extensible) |
| Consumidores del monorepo | jedami-web (Vue 3), jedami-mobile (Flutter) |
| Decisiones previas | Migraciones SQL manuales (sin ORM-generated), arquitectura en capas confirmada |

### Preocupaciones Transversales Identificadas

1. **Auth/RBAC** — atraviesa todos los endpoints protegidos; capas de middleware JWT + roles
2. **Split rutas públicas vs protegidas** — listado de productos es sin autenticación; pedidos/pagos requieren JWT
3. **Contexto de modo de la tienda** — el modo minorista/mayorista se propaga por contexto de request en los endpoints de productos
4. **Atomicidad de stock** — la validación y reserva de stock debe ser transaccional en todos los flujos de compra
5. **Abstracción de pagos** — servicio de pago detrás de una interfaz; Mercado Pago como primer adaptador
6. **Límite del módulo mayorista** — lógica de curva y cantidad completamente encapsulada; integración por contrato con el core de pedidos
7. **Desacoplamiento de eventos** — eventos de dominio (stock actualizado, cambio de estado de pedido) necesitan un bus interno para activación real-time futura

---

## Evaluación de Starter Templates

### Dominio Tecnológico Principal

API Backend (BFF) + Web + Mobile — monorepo con tres servicios independientes.

### Starters Utilizados

Los tres servicios ya fueron inicializados. Las decisiones de starter están tomadas:

| Servicio | Starter / Setup |
|---|---|
| `jedami-bff` | Setup manual — Express + TypeScript |
| `jedami-web` | `npm create vue@latest` — Vue 3 + Vite + TypeScript + Router + Pinia + ESLint |
| `jedami-mobile` | `flutter create` — Flutter 3.41.4 + Material 3 |

### Decisiones Arquitectónicas Establecidas por los Starters

**jedami-bff (Backend / BFF):**
- Runtime: Node.js v24 + TypeScript estricto
- Framework HTTP: Express 5.x (control total, sin opinionamiento)
- ORM: TypeORM 0.3 con decoradores
- Base de datos: PostgreSQL (migraciones SQL manuales)
- Testing: Jest
- Build: tsx (desarrollo), tsc (producción)

**jedami-web (Frontend Web):**
- Framework: Vue 3 + Composition API
- Build: Vite 7.x
- Estado: Pinia
- Routing: Vue Router 5.x
- Tipado: TypeScript + vue-tsc
- Linting: ESLint + OxLint
- Testing E2E: Cypress

**jedami-mobile (App Mobile):**
- Framework: Flutter 3.41.4 (Material 3)
- Navegación: go_router
- Estado: Riverpod
- HTTP: Dio
- Plataformas: Android, iOS, Web, Linux (desktop)

### Despliegue e Infraestructura

- **Contenedores:** Docker + Docker Compose
- Cada servicio tendrá su propio `Dockerfile`
- `docker-compose.yml` en la raíz del monorepo orquesta: BFF + PostgreSQL (+ futura expansión)

### Testing por Servicio

| Servicio | Framework | Tipo |
|---|---|---|
| `jedami-bff` | Jest | Unit + Integration |
| `jedami-web` | Cypress | E2E |
| `jedami-mobile` | Flutter Test | Widget + Integration |

**Nota:** La configuración de Docker y los primeros tests deben ser historias de implementación tempranas.

---

## Decisiones Arquitectónicas Centrales

### D1 — Acceso a Base de Datos

| Campo | Valor |
|---|---|
| Decisión | SQL puro con driver `pg` |
| Alternativa descartada | TypeORM |
| Rationale | Control total sobre las queries; sin abstracción que oculte comportamiento; más predecible para agentes de IA implementando |
| Patrón | Queries SQL en archivos `.ts` dedicados por módulo (`modules/<nombre>/queries/*.ts`), ejecutadas vía `pg.Pool` en los repositorios |
| Afecta | Todos los módulos con persistencia (users, roles, products, orders, payments) |

### D2 — Caché

| Campo | Valor |
|---|---|
| Decisión | Redis |
| Uso en Fase 1 | Caché de catálogo de productos y sesiones |
| Implementación | Servicio `redis` en docker-compose; cliente `ioredis` en BFF |
| Deferido | Configuración de caché real → Fase 2 (cuando exista catálogo) |

### D3 — Tokens de Autenticación

| Campo | Valor |
|---|---|
| Decisión | Access token único, expiración 24h |
| Alternativa descartada | Refresh token persistido |
| Rationale | Simplicidad en Fase 1; el refresh token puede agregarse en Fase 5 si es necesario |
| Afecta | `JWT_EXPIRES_IN=24h` en `.env`; payload JWT |

### D4 — Rate Limiting

| Campo | Valor |
|---|---|
| Decisión | Diferido a Fase 5 (Operación) |
| Rationale | No es bloqueante para MVP; se implementa con `express-rate-limit` en Fase 5 |

### D5 — Versionado de API

| Campo | Valor |
|---|---|
| Decisión | Prefijo `/api/v1/` desde el inicio |
| Aplicado | `app.use('/api/v1', routes)` en `app.ts` |
| Docs | Disponibles en `/api/docs` (Swagger UI) |

### D6 — Formato de Errores

| Campo | Valor |
|---|---|
| Decisión | RFC 7807 — Problem Details for HTTP APIs |
| Formato | `{ type, title, status, detail, instance? }` |
| Rationale | Estándar reconocido; facilita contratos con frontend |
| Pendiente | Implementar middleware de error handler centralizado |

### D7 — Documentación de API

| Campo | Valor |
|---|---|
| Decisión | Swagger UI + OpenAPI 3.0 generado con `swagger-jsdoc` |
| URL | `/api/docs` |
| Propósito | Contratos formales con jedami-web y jedami-mobile |
| Instalado | `swagger-jsdoc`, `swagger-ui-express` en jedami-bff |

### D8 — Cliente HTTP (jedami-web)

| Campo | Valor |
|---|---|
| Decisión | Axios |
| Instalado | `axios` en jedami-web |
| Uso | Instancia centralizada con base URL `/api/v1` e interceptores para JWT |

### D9 — Librería de Componentes UI (jedami-web)

| Campo | Valor |
|---|---|
| Decisión | shadcn-vue |
| Rationale | Headless, accesible, composable con Tailwind CSS; no impone diseño |
| Pendiente | Configuración inicial con Tailwind CSS (historia de implementación) |

### D10 — CI/CD

| Campo | Valor |
|---|---|
| Decisión | GitHub Actions |
| Pipeline inicial | lint → type-check → build por servicio en cada PR a main |
| Pendiente | Crear `.github/workflows/ci.yml` (historia de implementación) |

### D11 — Logging (jedami-bff)

| Campo | Valor |
|---|---|
| Decisión | pino + pino-pretty (dev) |
| Rationale | Logging estructurado JSON en producción; output legible en desarrollo |
| Instalado | `pino`, `pino-http`, `pino-pretty` en jedami-bff |
| Configurado | `src/config/logger.ts`; nivel vía `LOG_LEVEL` en `.env` |

---

### Decisiones Diferidas

| Decisión | Fase |
|---|---|
| Rate limiting (`express-rate-limit`) | Fase 5 |
| Refresh tokens | Fase 5 (si necesario) |
| Caché Redis activa | Fase 2 (con catálogo) |
| shadcn-vue setup completo + Tailwind | Historia de impl. temprana |
| GitHub Actions CI workflow | Historia de impl. temprana |
| Error handler RFC 7807 centralizado | Historia de impl. temprana |

---

## Modelo de Datos (DER — Referencia Canónica)

> Referencia: `docs/der.md`. Este modelo define las tablas físicas en PostgreSQL.

### Entidades y Columnas

| Tabla | Columnas | Notas |
|---|---|---|
| `users` | `id`, `email`, `password_hash`, `created_at` | Cuenta de autenticación |
| `roles` | `id`, `name` | `admin`, `retail`, `wholesale` |
| `user_roles` | `user_id` (FK), `role_id` (FK) | N-N entre users y roles |
| `customers` | `id`, `name`, `email`, `customer_type`, `user_id?` (FK nullable) | Perfil comercial; separado de `users`; `customer_type` determina reglas de compra |
| `products` | `id`, `name`, `description` | Sin precio propio — el precio vive en variantes |
| `variants` | `id`, `product_id` (FK), `size`, `color`, `retail_price` | Una variante = combinación única de talle + color. El precio minorista está aquí |
| `stock` | `variant_id` (PK, FK), `quantity` | Relación 1-1 con `variants`; `variant_id` es la PK |
| `orders` | `id`, `customer_id` (FK), `status`, `total_amount`, `created_at` | Se asocia a `customers`, no a `users` directamente |
| `order_items` | `id`, `order_id` (FK), `variant_id` (FK), `quantity`, `unit_price` | `unit_price` = copia histórica de `retail_price` al momento de la compra |

### Relaciones Clave

```
users          1 ---- N  user_roles  N ---- 1  roles
users          1 ---- 0..1  customers   (un user puede tener perfil customer)
customers      1 ---- N  orders
products       1 ---- N  variants
variants       1 ---- 1  stock           (variant_id es PK en stock)
orders         1 ---- N  order_items
variants       1 ---- N  order_items
```

### Decisiones de Diseño del Modelo

| Principio | Implementación |
|---|---|
| El precio vive en la variante | `variants.retail_price` es la única fuente de precio en Fase 1 |
| El stock es por variante | `stock.variant_id` es PK — no hay stock a nivel de producto |
| Los pedidos registran precio histórico | `order_items.unit_price` es una copia del precio al momento de compra; no depende del precio actual |
| `customers` ≠ `users` | `users` es la cuenta de autenticación; `customers` es el perfil comercial con `customer_type` |
| Variante = talle + color | Dos variantes del mismo producto pueden compartir talle pero diferir en color, y viceversa |

### Implicaciones para los Módulos

- **`modules/products/`**: Las queries de producto deben hacer JOIN con `variants` para exponer talle, color y precio
- **`modules/stock/`**: Todas las operaciones de stock usan `variant_id` como clave
- **`modules/orders/`**: Los ítems de pedido se crean copiando `retail_price` de la variante en `unit_price`; el pedido se asocia a `customer_id`, no a `user_id` directamente
- **`modules/wholesale/`**: La compra por curva valida stock de cada variante (talle+color); la compra por cantidad valida la suma de `stock.quantity` de todas las variantes del producto

---

## Patrones de Implementación y Reglas de Consistencia

### Puntos de conflicto identificados: 6 zonas críticas

---

### Nomenclatura de Base de Datos

| Elemento | Patrón | Ejemplo |
|---|---|---|
| Tablas | `snake_case` plural | `users`, `roles`, `user_roles`, `order_items` |
| Columnas | `snake_case` | `password_hash`, `created_at`, `unit_price` |
| Foreign keys | `{tabla_singular}_id` | `user_id`, `role_id`, `order_id` |
| Índices | `idx_{tabla}_{columna}` | `idx_users_email`, `idx_orders_user_id` |

---

### Nomenclatura de API y Código

**Endpoints REST:**
- Plural, `kebab-case` → `/api/v1/users`, `/api/v1/order-items`
- Route params: `:id`, `:userId`, `:orderId`
- Query params: `camelCase` → `?storeMode=wholesale&pageSize=20`

**Archivos TypeScript:**
- Nombre de archivo: `kebab-case` → `users.service.ts`, `find-by-email.ts`
- Interfaces / Types / Clases: `PascalCase` → `User`, `CreateUserDTO`, `OrderItem`
- Funciones y variables: `camelCase` → `findByEmail`, `createOrder`, `passwordHash`

**Anti-patrones:**
```
❌ /api/v1/User           → ✅ /api/v1/users
❌ usersService.ts        → ✅ users.service.ts
❌ find_by_email()        → ✅ findByEmail()
❌ column: userId (en DB) → ✅ column: user_id (en DB)
```

---

### Formato de Respuestas API

**Respuesta exitosa:**
```json
{
  "data": { "id": 1, "email": "user@jedami.com" },
  "meta": { "page": 1, "total": 42 }
}
```
*Para respuestas sin paginación, `meta` se omite.*

**Respuesta de error (RFC 7807):**
```json
{
  "type": "/errors/user-not-found",
  "title": "Usuario no encontrado",
  "status": 404,
  "detail": "No existe un usuario con email foo@bar.com"
}
```

**Reglas de formato:**
- Fechas: ISO 8601 → `"2026-03-10T15:00:00.000Z"`
- IDs: `number` (integer de PostgreSQL)
- Campos JSON hacia el cliente: `camelCase` (el BFF mapea desde `snake_case` de DB)
- Booleanos: `true` / `false` (nunca `1` / `0`)

**Anti-patrones:**
```
❌ res.json({ password_hash: "..." })  → el BFF nunca expone password_hash
❌ res.json({ error: "not found" })    → usar RFC 7807
❌ { created_at: "..." }               → ✅ { createdAt: "..." } en respuesta
```

---

### Estructura de Tests

| Servicio | Framework | Ubicación |
|---|---|---|
| `jedami-bff` | Jest | Co-locados: `src/modules/users/users.service.test.ts` |
| `jedami-web` | Cypress | `jedami-web/cypress/e2e/` |
| `jedami-mobile` | Flutter Test | `jedami-mobile/test/` |

---

### Eventos de Dominio (Bus interno — futuro)

- Naming: `dominio.accion` en pasado → `user.created`, `order.paid`, `stock.updated`
- Payload siempre incluye: `{ event, occurredAt, payload }`

---

### Estado y Fetching en jedami-web

- **Stores Pinia:** uno por módulo de negocio → `useUsersStore`, `useProductsStore`, `useOrdersStore`
- **Cliente HTTP:** instancia Axios centralizada en `src/api/client.ts` con interceptor JWT
- **Loading states:** `ref<boolean>` local dentro de composables — no estado de carga global

---

### Reglas obligatorias para todos los agentes

1. **NUNCA** exponer `password_hash` en ninguna respuesta de API
2. **SIEMPRE** usar el wrapper `{ data }` en respuestas exitosas
3. **SIEMPRE** usar RFC 7807 para errores
4. **SIEMPRE** mapear `snake_case` de DB a `camelCase` antes de responder
5. **SIEMPRE** ubicar queries SQL en `modules/<nombre>/queries/*.ts`
6. **SIEMPRE** montar rutas bajo `/api/v1/`
7. **NUNCA** hacer queries SQL directamente en servicios — usar repositorios
8. **SIEMPRE** usar `variant_id` como clave en operaciones de stock (no `product_id`)
9. **SIEMPRE** copiar `retail_price` de la variante en `order_items.unit_price` al crear un ítem de pedido
10. **NUNCA** exponer ni modificar `order_items.unit_price` después de crear el pedido — es registro histórico inmutable
11. **SIEMPRE** asociar pedidos a `customer_id`, no a `user_id` directamente
12. Las queries de productos deben hacer JOIN con `variants` para exponer talle, color y precio

---

## Estructura del Proyecto y Límites Arquitectónicos

### Mapeo RF → Módulos

| Requerimientos | Módulo BFF |
|---|---|
| RF-01, RF-02 | `modules/auth/` |
| RF-03, RF-04, RF-05 | `modules/roles/` |
| RF-06, RF-07 | `modules/products/` + `modules/customers/` (perfil comercial) |
| RF-08, RF-09 | `modules/orders/` |
| RF-10, RF-10.1, RF-10.2, RF-10.3 | `modules/wholesale/` (encapsulado, contrato explícito) |
| RF-11 | `modules/stock/` (servicio transversal, consumido por orders y wholesale) |
| RF-12 | `modules/payments/` + `adapters/mercadopago/` |
| DER: entidad Customer | `modules/customers/` (separado de `users` — es el perfil comercial del comprador) |

### Árbol Completo del Monorepo

```
tienda-jedami/                          ← raíz del monorepo
├── Makefile
├── .gitignore
├── docker-compose.yml                  ← BFF + PostgreSQL + Redis
├── .github/
│   └── workflows/
│       └── ci.yml                      ← lint + type-check + build por servicio
├── docs/                               ← documentación de negocio
├── _bmad-output/                       ← artefactos de planificación
│
├── jedami-bff/                         ← Backend / BFF
│   ├── package.json
│   ├── tsconfig.json
│   ├── Makefile
│   ├── Dockerfile
│   ├── .env
│   ├── .env.example
│   ├── jest.config.ts
│   └── src/
│       ├── index.ts                    ← bootstrap (pino + pg pool + express)
│       ├── app.ts                      ← Express + Swagger UI + rutas /api/v1
│       ├── config/
│       │   ├── env.ts
│       │   ├── database.ts             ← pg Pool
│       │   ├── logger.ts               ← pino
│       │   └── swagger.ts              ← OpenAPI 3.0 spec
│       ├── middlewares/
│       │   ├── auth.middleware.ts      ← JWT verify
│       │   ├── role.middleware.ts      ← RBAC
│       │   └── error.middleware.ts     ← RFC 7807 handler centralizado
│       ├── routes/
│       │   ├── index.ts                ← /api/v1 router raíz
│       │   ├── auth.routes.ts
│       │   ├── users.routes.ts
│       │   ├── products.routes.ts
│       │   ├── orders.routes.ts
│       │   └── payments.routes.ts
│       ├── types/
│       │   └── express.d.ts            ← req.user augmentation
│       └── modules/
│           ├── auth/
│           │   ├── jwt-payload.ts
│           │   ├── auth.controller.ts
│           │   └── auth.service.ts
│           ├── users/
│           │   ├── users.entity.ts     ← interface User (sin ORM)
│           │   ├── users.repository.ts
│           │   ├── users.service.ts
│           │   ├── users.controller.ts
│           │   ├── users.service.test.ts
│           │   └── queries/
│           │       ├── find-by-email.ts
│           │       ├── find-by-email-with-roles.ts
│           │       └── create-user.ts
│           ├── roles/
│           │   ├── roles.entity.ts     ← interface Role (sin ORM)
│           │   ├── roles.repository.ts
│           │   ├── roles.controller.ts
│           │   └── queries/
│           │       └── find-by-name.ts
│           ├── products/
│           │   ├── products.entity.ts  ← interface Product
│           │   ├── variants.entity.ts  ← interface Variant { id, productId, size, color, retailPrice }
│           │   ├── products.repository.ts
│           │   ├── products.service.ts
│           │   ├── products.controller.ts
│           │   ├── products.service.test.ts
│           │   └── queries/
│           │       ├── find-all-with-variants.ts  ← JOIN products + variants + stock
│           │       ├── find-by-id-with-variants.ts
│           │       ├── create-product.ts
│           │       └── create-variant.ts
│           ├── customers/              ← perfil comercial (separado de users)
│           │   ├── customers.entity.ts ← interface Customer { id, name, email, customerType, userId? }
│           │   ├── customers.repository.ts
│           │   └── queries/
│           │       ├── find-by-user-id.ts
│           │       └── create-customer.ts
│           ├── stock/                  ← servicio transversal (RF-11)
│           │   ├── stock.entity.ts     ← interface Stock { variantId, quantity }
│           │   ├── stock.service.ts
│           │   ├── stock.service.test.ts
│           │   └── queries/
│           │       ├── get-stock-by-variant.ts
│           │       ├── get-stock-by-product.ts   ← suma stock de todas las variantes
│           │       └── reserve-stock.ts
│           ├── wholesale/              ← módulo encapsulado (RF-10.x)
│           │   ├── wholesale.service.ts
│           │   ├── wholesale.service.test.ts
│           │   ├── curve-purchase.ts   ← lógica RF-10.1
│           │   ├── quantity-purchase.ts← lógica RF-10.2
│           │   └── wholesale.types.ts  ← contrato público del módulo
│           ├── orders/
│           │   ├── orders.entity.ts    ← interface Order { id, customerId, status, totalAmount, createdAt }
│           │   ├── order-item.entity.ts← interface OrderItem { id, orderId, variantId, quantity, unitPrice }
│           │   ├── orders.repository.ts
│           │   ├── orders.service.ts
│           │   ├── orders.controller.ts
│           │   ├── orders.service.test.ts
│           │   └── queries/
│           │       ├── create-order.ts
│           │       ├── create-order-item.ts  ← copia unit_price desde variant.retail_price
│           │       └── find-by-customer.ts
│           └── payments/
│               ├── payments.service.ts
│               ├── payments.controller.ts
│               ├── payment-provider.interface.ts  ← abstracción (RF-12 extensibilidad)
│               └── adapters/
│                   └── mercadopago/
│                       ├── mercadopago.adapter.ts
│                       └── mercadopago.types.ts
│
├── jedami-web/                         ← Frontend Vue 3
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── index.html
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── api/
│   │   │   ├── client.ts               ← instancia Axios + interceptor JWT
│   │   │   ├── auth.api.ts
│   │   │   ├── products.api.ts
│   │   │   └── orders.api.ts
│   │   ├── stores/                     ← Pinia (uno por módulo de negocio)
│   │   │   ├── auth.store.ts
│   │   │   ├── products.store.ts
│   │   │   └── orders.store.ts
│   │   ├── router/
│   │   │   └── index.ts
│   │   ├── views/
│   │   │   ├── LoginView.vue
│   │   │   ├── RegisterView.vue
│   │   │   ├── CatalogView.vue
│   │   │   ├── ProductView.vue
│   │   │   └── OrdersView.vue
│   │   ├── components/
│   │   │   ├── ui/                     ← shadcn-vue componentes base
│   │   │   └── features/
│   │   │       ├── catalog/
│   │   │       └── checkout/
│   │   └── types/
│   │       └── api.ts                  ← tipos de respuesta del BFF
│   └── cypress/
│       └── e2e/
│           ├── auth.cy.ts
│           └── catalog.cy.ts
│
└── jedami-mobile/                      ← App Flutter
    ├── pubspec.yaml
    ├── lib/
    │   ├── main.dart
    │   ├── app.dart                    ← GoRouter + MaterialApp
    │   ├── core/
    │   │   ├── api/
    │   │   │   └── client.dart         ← Dio + interceptor JWT
    │   │   └── constants.dart
    │   ├── features/
    │   │   ├── auth/
    │   │   │   ├── screens/
    │   │   │   └── providers/          ← Riverpod
    │   │   ├── catalog/
    │   │   │   ├── screens/
    │   │   │   └── providers/
    │   │   └── orders/
    │   │       ├── screens/
    │   │       └── providers/
    │   └── shared/
    │       └── widgets/
    └── test/
        └── features/
```

### Límites Arquitectónicos

**Límite público del módulo wholesale:**
- Solo `wholesale.service.ts` es consumido externamente (por `orders.service.ts`)
- `curve-purchase.ts` y `quantity-purchase.ts` son internos al módulo
- El contrato está definido en `wholesale.types.ts`

**Límite de autenticación:**
- Rutas públicas: `GET /api/v1/products`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login`
- Rutas protegidas (JWT): todo lo demás
- Rutas admin-only (JWT + rol `admin`): `POST/PUT /api/v1/products`, gestión de roles
- Rutas wholesale-only (JWT + rol `wholesale`): pedidos con `purchase_type: curva|cantidad`

**Flujo de datos:**
```
Cliente (web/mobile)
  → GET /api/v1/products?storeMode=wholesale
  → products.controller → products.service → products.repository → SQL → PostgreSQL
  → Mapeo snake_case → camelCase
  → { data: [...] }
```

```
Cliente autenticado
  → POST /api/v1/orders
  → auth.middleware → role.middleware → orders.controller
  → orders.service → wholesale.service (si mayorista) → stock.service (validación atómica)
  → orders.repository → PostgreSQL (transacción)
  → payments.service → mercadopago.adapter → Mercado Pago API
  → { data: { orderId, checkoutUrl } }
```

**Integraciones externas:**
- Mercado Pago API → solo desde `modules/payments/adapters/mercadopago/`
- PostgreSQL → solo desde repositorios vía `config/database.ts`
- Redis (Fase 2+) → servicio de caché dedicado, no acceso directo desde módulos

---

## Resultados de Validación Arquitectónica

### Coherencia ✅ — Sin conflictos entre decisiones

| Verificación | Resultado |
|---|---|
| SQL puro + pg + TypeScript + Express | Compatible, sin conflictos |
| pino + swagger-jsdoc + swagger-ui-express + Express | Compatible |
| Vue 3 + Vite + Pinia + Axios + shadcn-vue | Stack cohesivo |
| Flutter + go_router + Riverpod + Dio | Stack cohesivo |
| Docker + docker-compose ← todos los servicios | Compatible |
| JWT 24h sin refresh token | Decisión simple y coherente |
| Patrones snake_case (DB) → camelCase (API) | Consistente con pg raw driver |

### Cobertura ✅ — Los 12 RF y 7 NFR están soportados arquitectónicamente

| RF | Módulo / Mecanismo |
|---|---|
| RF-01 Registro | `modules/auth/` + `modules/users/` |
| RF-02 Autenticación JWT | `modules/auth/` + `auth.middleware.ts` |
| RF-03 Gestión de roles | `modules/roles/` |
| RF-04 Asignación de roles | `users.repository.assignRole()` |
| RF-05 RBAC | `role.middleware.ts` |
| RF-06 Gestión productos (admin) | `modules/products/` + role guard |
| RF-07 Visualización pública + modo | ruta pública + query param `storeMode` |
| RF-08 Creación de pedidos | `modules/orders/` |
| RF-09 Modalidades retail/wholesale | `orders.service` ↔ `wholesale.service` |
| RF-10.1 Compra por curva | `wholesale/curve-purchase.ts` |
| RF-10.2 Compra por cantidad | `wholesale/quantity-purchase.ts` |
| RF-10.3 Selección tipo compra | `wholesale.types.ts` + orders controller |
| RF-11 Validación stock atómica | `modules/stock/` (transversal) |
| RF-12 Mercado Pago | `payments/adapters/mercadopago/` + interfaz |

### Preparación ✅ — Los agentes de IA pueden implementar de forma consistente

### Checklist de Completitud

- [x] Contexto del proyecto analizado y documentado
- [x] Escala y complejidad evaluadas (Medio-Alto, 8–10 módulos)
- [x] Restricciones técnicas identificadas
- [x] Preocupaciones transversales mapeadas
- [x] Decisiones críticas documentadas (D1–D11)
- [x] Stack tecnológico completamente especificado con versiones
- [x] Patrones de implementación definidos (6 zonas de conflicto resueltas)
- [x] Convenciones de nomenclatura establecidas
- [x] Estructura completa del directorio definida
- [x] Límites de componentes y módulo wholesale establecidos
- [x] Mapeo RF → estructura completo
- [x] Flujos de datos documentados
- [x] Modelo de datos completo (DER: 6 entidades con columnas y relaciones documentadas)
- [x] Separación `users` vs `customers` documentada y reflejada en módulos
- [x] Precio en variante (`retail_price`), stock 1-1 con variante, precio histórico en `order_items` — todos documentados

### Análisis de Brechas

**Brechas no bloqueantes — historias de implementación tempranas:**

| Brecha | Prioridad |
|---|---|
| `error.middleware.ts` handler centralizado RFC 7807 | Alta |
| `docker-compose.yml` con BFF + PostgreSQL + Redis | Alta |
| Separar `auth.routes.ts` de `users.routes.ts` | Media |
| shadcn-vue + Tailwind setup en jedami-web | Media |
| `.github/workflows/ci.yml` | Media |

**Sin brechas críticas que bloqueen la implementación.**

### Estado de Preparación: LISTO PARA IMPLEMENTACIÓN

**Nivel de confianza: Alto**

**Fortalezas clave:**
- Módulo wholesale completamente encapsulado con contrato explícito
- Abstracción de pagos preparada para múltiples proveedores
- SQL puro predecible y auditable por cualquier agente
- Patrones de nomenclatura sin ambigüedad
- Estructura monorepo clara con límites bien definidos

**Primeras historias de implementación recomendadas:**
1. `error.middleware.ts` — handler centralizado RFC 7807
2. `docker-compose.yml` — BFF + PostgreSQL + Redis
3. `auth.routes.ts` — separar rutas de auth de users
4. shadcn-vue + Tailwind setup en jedami-web
5. `.github/workflows/ci.yml` — pipeline CI

---

## Estrategia de Desarrollo Paralelo

El monorepo se desarrolla en paralelo: **backend (`jedami-bff`) y frontends (`jedami-web`, `jedami-mobile`) avanzan de forma sincronizada**, sin esperar que el backend esté completamente terminado.

### Criterio de sincronía

| Épica BFF completada | Frontends pueden arrancar |
|---|---|
| Épica 1 — Catálogo + Auth | Vistas de catálogo, login y registro en web y mobile |
| Épica 2 — Compra mayorista | Flujo de pedido mayorista en web y mobile |
| Épica 3 — Pagos MP | Checkout y confirmación de pago en web y mobile |
| Épica 4 — Compra minorista | Flujo de compra minorista completo en web y mobile |

### Contrato entre servicios

- El BFF expone Swagger UI en `/api/docs` — los equipos de frontend usan esta documentación como contrato
- Los frontends consumen únicamente `/api/v1/` — nunca acceden directamente a PostgreSQL ni a Mercado Pago
- El cliente Axios (`jedami-web/src/api/client.ts`) y el cliente Dio (`jedami-mobile/lib/core/api/client.dart`) son los únicos puntos de integración con el BFF

### UX Design requerido antes de implementar frontends

Las épicas de `jedami-web` y `jedami-mobile` requieren un documento UX (`/bmad-bmm-create-ux-design`) que defina los flujos de pantallas, navegación y patrones de UI antes de comenzar su implementación.

---

## Integraciones y Herramientas de Desarrollo

### Mercado Pago — MCP + Variables de Entorno

**MCP configurado en Claude Code:**
- Servidor: `mercadopago` vía HTTP → `https://mcp.mercadopago.com/mcp`
- Disponible durante el desarrollo para consultar la API de MP directamente desde el agente
- Configurado en `.claude.json` (local, no commiteado)

**Variables de entorno (en `jedami-bff/.env`, nunca commiteadas):**

| Variable | Descripción |
|---|---|
| `MP_PUBLIC_KEY` | Clave pública de Mercado Pago (TEST en desarrollo) |
| `MP_ACCESS_TOKEN` | Access token de Mercado Pago (TEST en desarrollo) |
| `MP_WEBHOOK_SECRET` | Secreto para validar firma del webhook |

**Ambiente actual:** TEST (sandbox) — para pasar a producción se reemplazan las keys en `.env` sin tocar el código.

**Referencia en el código:**
- Variables expuestas vía `src/config/env.ts` → `ENV.MP_PUBLIC_KEY`, `ENV.MP_ACCESS_TOKEN`, `ENV.MP_WEBHOOK_SECRET`
- Solo accesibles desde `modules/payments/adapters/mercadopago/`
- `.env.example` documenta las variables requeridas sin exponer valores
