---
stepsCompleted: [1, 2, 3, 4]
status: complete
completedAt: '2026-03-10'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# tienda-jedami - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for tienda-jedami, decomposing the requirements from the PRD and Architecture into implementable stories ordered by business value.

## Requirements Inventory

### Functional Requirements

RF-01: Registro de Usuarios — `POST /auth/register` acepta email + password; bcrypt; email único; retorna 201 sin exponer password
RF-02: Autenticación JWT — `POST /auth/login`; verifica hash; retorna JWT 24h con id y roles del usuario
RF-03: Gestión de Roles — roles admin, retail, wholesale consultables y creables por admin
RF-04: Asignación de Roles a Usuarios — admin puede asignar uno o varios roles; efecto inmediato
RF-05: Autorización RBAC — middleware JWT + rol; 401 sin token; 403 sin rol requerido
RF-06: Gestión de Productos con Variantes — CRUD admin; variante = talle + color + retail_price; stock por variant_id
RF-07: Visualización pública del catálogo — sin autenticación; variantes + precio según query param mode=retail|wholesale; paginación
RF-08: Creación de Pedidos — asociado a customer_id; order_items con variant_id + quantity + unit_price (histórico); estado inicial pending
RF-09: Modalidades de Venta — modo visualización (contexto tienda) ≠ modo compra (rol usuario); visitante puede ver precios
RF-10: Compra Mayorista — solo rol wholesale; requiere selección de purchase_type antes de crear pedido
RF-10.1: Compra por Curva — tipo=curva; 1 unidad de cada variante disponible; N curvas; valida stock por variante >= N
RF-10.2: Compra por Cantidad — tipo=cantidad; quantity=N; valida suma stock todas las variantes >= N
RF-10.3: Selección del Tipo de Compra — campo purchase_type: curva|cantidad; 400 si no se especifica en compra mayorista
RF-11: Validación de Stock atómica — transaccional; sin reducir stock hasta confirmar; 422 con detalle del fallo por variante
RF-12: Integración Mercado Pago — checkout (`POST /payments/:orderId/checkout`); webhook (`POST /payments/webhook`); estados approved/rejected/pending; registro histórico del pago

### NonFunctional Requirements

RNF-01: Seguridad — bcrypt salt ≥ 10; JWT expiración 24h; middleware en rutas sensibles; validación firma webhook MP; nunca exponer password_hash
RNF-02: Persistencia y Consistencia — PostgreSQL; FK enforced; transacciones atómicas en operaciones de stock + pedidos; sin estados inconsistentes ante errores
RNF-03: Arquitectura en capas — API (controladores/rutas) → Dominio (servicios) → Infraestructura (repositorios/queries); módulo wholesale encapsulado con contrato explícito
RNF-04: Escalabilidad — Open/Closed; nuevos medios de pago sin modificar lógica de pedidos; nuevas modalidades sin refactorizaciones masivas
RNF-05: Mantenibilidad — código legible y modular; nombres descriptivos; linting (ESLint) y formateo consistente
RNF-06: Modularidad del módulo wholesale — lógica de curva y cantidad completamente encapsulada; integración por contrato con core de pedidos
RNF-07: Tiempo real desacoplado — bus de eventos interno preparado pero no activado; activación progresiva por módulo en Fase F

### Additional Requirements

- **Infra:** Docker Compose con BFF + PostgreSQL + Redis; Dockerfile por servicio
- **API:** versionado `/api/v1/`; errores RFC 7807 `{type, title, status, detail}`; Swagger UI en `/api/docs`; pino logger con `LOG_LEVEL` configurable
- **DB:** SQL puro con `pg` Pool; queries en `modules/<nombre>/queries/*.ts`; sin ORM
- **Modelo de datos:** 9 tablas — users, user_roles, roles, customers, products, variants, stock, orders, order_items
- **Separación users/customers:** `users` = cuenta auth; `customers` = perfil comercial con `customer_type`
- **Precio histórico:** `order_items.unit_price` = copia de `variants.retail_price` al momento de compra; inmutable
- **Stock:** 1-1 con variante; `variant_id` es PK en tabla `stock`; todas las queries de stock usan `variant_id`
- **Respuestas API:** wrapper `{ data }` en éxito; mapeo snake_case → camelCase siempre
- **jedami-web:** cliente Axios centralizado + interceptor JWT; stores Pinia por módulo; shadcn-vue + Tailwind (setup inicial)
- **jedami-mobile:** go_router + Riverpod + cliente Dio con interceptor JWT
- **CI:** GitHub Actions lint → type-check → build por servicio en PR a main
- **Mercado Pago MCP:** configurado en Claude Code con credenciales TEST; variables en `.env` nunca commiteadas

### FR Coverage Map

| RF | Épica | Descripción breve |
|---|---|---|
| RF-01 | Épica 1 | Registro de admin; Épica 2 registro mayorista; Épica 4 registro minorista |
| RF-02 | Épica 1 | Auth JWT 24h |
| RF-03 | Épica 1 | Roles admin/retail/wholesale |
| RF-04 | Épica 1 | Asignación rol admin; Épica 2 rol wholesale; Épica 4 rol retail |
| RF-05 | Épica 1 | Middleware RBAC |
| RF-06 | Épica 1 | CRUD productos + variantes (talle + color + retail_price) |
| RF-07 | Épica 1 | Catálogo público con variantes y precios |
| RF-08 | Épica 2 | Creación pedidos mayoristas (customer_id, order_items con unit_price histórico) |
| RF-08 | Épica 4 | Creación pedidos minoristas |
| RF-09 | Épica 2 | Modalidad mayorista (compra); Épica 4 modalidad minorista |
| RF-10 | Épica 2 | Compra mayorista (solo wholesale) |
| RF-10.1 | Épica 2 | Compra por curva |
| RF-10.2 | Épica 2 | Compra por cantidad |
| RF-10.3 | Épica 2 | Selección purchase_type |
| RF-11 | Épica 2 | Validación stock mayorista; Épica 4 validación stock minorista |
| RF-12 | Épica 3 | Checkout + webhook MP para mayoristas |
| RF-12 | Épica 4 | Checkout + webhook MP para minoristas |

## Epic List

### Epic 1: Gestión del Catálogo de Productos
El administrador puede cargar y gestionar productos con variantes (talle + color + precio + stock), y cualquier visitante puede explorar el catálogo público con precios.
**FRs cubiertos:** RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07

### Epic 2: Compra Mayorista
Un comprador mayorista puede registrarse, crear pedidos en modalidad curva o por cantidad, con validación de stock atómica y descuento real de stock.
**FRs cubiertos:** RF-08, RF-09, RF-10, RF-10.1, RF-10.2, RF-10.3, RF-11

### Epic 3: Pagos con Mercado Pago (Mayoristas)
El mayorista puede pagar sus pedidos mediante Mercado Pago. El sistema procesa el resultado vía webhook y actualiza el estado del pedido automáticamente.
**FRs cubiertos:** RF-12 (para pedidos mayoristas)

### Epic 4: Compra Minorista con Pago
Un comprador minorista puede registrarse, comprar cualquier variante en cualquier cantidad y completar el pago con Mercado Pago.
**FRs cubiertos:** RF-08 (retail), RF-09 (retail), RF-11 (retail), RF-12 (retail)

### Epic 5: Escalabilidad y Operación _(diferida)_
El sistema soporta carga real de producción con caché Redis activo, rate limiting y sesiones optimizadas.
**Incluye:** Redis cache activo, rate limiting, refresh tokens, bus de eventos tiempo real

---

## Epic 1: Gestión del Catálogo de Productos

El administrador puede cargar y gestionar productos con variantes (talle + color + precio + stock), y cualquier visitante puede explorar el catálogo público con precios.

### Story 1.1: Infraestructura Base del Proyecto

Como desarrollador,
quiero una base técnica funcional con base de datos, pool de conexiones, logging, manejo de errores y documentación de API,
para que todas las funcionalidades posteriores puedan construirse sobre una fundación estable.

**Acceptance Criteria:**

**Given** el repositorio `jedami-bff` está disponible
**When** se ejecuta `docker compose up`
**Then** levanta el contenedor BFF (Express) en el puerto configurado y el contenedor PostgreSQL
**And** las tablas `users`, `roles` y `user_roles` existen en la base de datos con sus FKs y constraints

**Given** la aplicación está corriendo
**When** se hace cualquier request HTTP
**Then** pino registra el request con método, path, status y tiempo de respuesta en formato estructurado (JSON en producción, colorizado en desarrollo)

**Given** ocurre un error no manejado en cualquier endpoint
**When** el middleware de error lo captura
**Then** responde con RFC 7807: `{ type, title, status, detail }` y el status HTTP correcto

**Given** el servidor está corriendo
**When** se accede a `GET /api/docs`
**Then** se muestra la interfaz Swagger UI con la especificación OpenAPI 3.0 del proyecto

**Given** el entorno de desarrollo
**When** se consulta `GET /api/v1/health`
**Then** responde `200 { data: { status: "ok" } }`

### Story 1.2: Registro y Autenticación de Administrador

Como administrador,
quiero registrarme con email y contraseña e iniciar sesión para obtener un token de acceso,
para que pueda gestionar el catálogo de productos de forma segura.

**Acceptance Criteria:**

**Given** un email no registrado y una contraseña válida
**When** se hace `POST /api/v1/auth/register` con `{ email, password }`
**Then** el sistema crea el usuario con la contraseña encriptada con bcrypt (salt ≥ 10)
**And** retorna `201 { data: { id, email, createdAt } }` sin exponer `passwordHash`

**Given** un email ya registrado
**When** se hace `POST /api/v1/auth/register` con ese email
**Then** retorna RFC 7807 `400` con detail indicando que el email ya existe

**Given** un usuario registrado con credenciales correctas
**When** se hace `POST /api/v1/auth/login` con `{ email, password }`
**Then** retorna `200 { data: { token } }` con JWT válido de 24h que incluye `{ id, roles }` en el payload

**Given** credenciales incorrectas
**When** se hace `POST /api/v1/auth/login`
**Then** retorna RFC 7807 `401` con detail genérico (sin indicar cuál campo es incorrecto)

### Story 1.3: Gestión de Roles y Control de Acceso (RBAC)

Como administrador autenticado,
quiero poder asignar roles a usuarios y que el sistema restrinja el acceso según el rol,
para que cada tipo de usuario solo acceda a las funcionalidades que le corresponden.

**Acceptance Criteria:**

**Given** la base de datos inicializada
**When** se ejecuta el seed de roles
**Then** existen los roles `admin`, `retail` y `wholesale` en la tabla `roles`

**Given** un admin autenticado (token JWT con rol admin)
**When** hace `POST /api/v1/users/:userId/roles` con `{ roleId }`
**Then** el rol queda asignado al usuario (tabla `user_roles`)
**And** retorna `200 { data: { userId, roleId } }`

**Given** un usuario autenticado sin rol `admin`
**When** intenta acceder a un endpoint protegido con `requireRole('admin')`
**Then** el middleware retorna RFC 7807 `403`

**Given** un request sin header `Authorization` o con token inválido
**When** llega a cualquier ruta protegida
**Then** el middleware de auth retorna RFC 7807 `401`

**Given** un usuario con rol `admin`
**When** hace `GET /api/v1/roles`
**Then** retorna `200 { data: [{ id, name }] }` con todos los roles disponibles

### Story 1.4: CRUD de Productos con Variantes

Como administrador autenticado,
quiero crear y gestionar productos con sus variantes de talle y color, incluyendo precio y stock inicial,
para que el catálogo refleje la oferta real de la tienda.

**Acceptance Criteria:**

**Given** las tablas `products`, `variants` y `stock` existen en la base de datos
**When** un admin hace `POST /api/v1/products` con `{ name, description }`
**Then** se crea el producto y retorna `201 { data: { id, name, description } }`

**Given** un producto existente
**When** un admin hace `POST /api/v1/products/:id/variants` con `{ size, color, retailPrice, initialStock }`
**Then** se crea la variante en `variants` con `size`, `color`, `retail_price`
**And** se crea el registro de stock en `stock` con `variant_id` como PK y `quantity = initialStock`
**And** retorna `201 { data: { id, productId, size, color, retailPrice, stock: { quantity } } }`

**Given** un admin autenticado
**When** hace `PUT /api/v1/products/:id` con datos actualizados
**Then** actualiza el producto y retorna `200 { data: { id, name, description } }`

**Given** un usuario sin rol `admin`
**When** intenta `POST /api/v1/products` o `PUT /api/v1/products/:id`
**Then** retorna RFC 7807 `403`

**Given** un `productId` inexistente
**When** se hace `GET /api/v1/products/:id`
**Then** retorna RFC 7807 `404`

### Story 1.5: Catálogo Público de Productos

Como visitante (autenticado o no),
quiero ver el catálogo de productos con todas sus variantes, precios y stock disponible,
para que pueda explorar la oferta antes de decidir si comprar.

**Acceptance Criteria:**

**Given** productos con variantes cargados en la base de datos
**When** se hace `GET /api/v1/products` sin token de autenticación
**Then** retorna `200 { data: [...], meta: { page, pageSize, total } }` con todos los productos y sus variantes
**And** cada variante incluye: `id`, `size`, `color`, `retailPrice`, `stock.quantity`

**Given** query param `mode=retail` (o sin mode)
**When** se hace `GET /api/v1/products`
**Then** el precio devuelto es `retailPrice` de cada variante

**Given** query param `mode=wholesale`
**When** se hace `GET /api/v1/products`
**Then** en Fase 1 también retorna `retailPrice` (el precio mayorista es extensión futura)

**Given** query params `page=2&pageSize=10`
**When** se hace `GET /api/v1/products`
**Then** retorna la página correspondiente con el total correcto en `meta`

**Given** un `productId` existente
**When** se hace `GET /api/v1/products/:id` sin autenticación
**Then** retorna `200 { data: { id, name, description, variants: [...] } }` con todas las variantes

---

## Epic 2: Compra Mayorista

Un comprador mayorista puede registrarse, crear pedidos en modalidad curva o por cantidad, con validación de stock atómica y descuento real de stock.

### Story 2.1: Registro de Comprador Mayorista y Perfil Customer

Como comprador mayorista,
quiero registrarme en el sistema y tener un perfil de comprador asociado a mi cuenta,
para que pueda generar pedidos con las reglas que corresponden a un mayorista.

**Acceptance Criteria:**

**Given** las tablas `customers`, `orders` y `order_items` existen en la base de datos con sus FKs y constraints
**When** se hace `POST /api/v1/auth/register` con `{ email, password }`
**Then** se crea el usuario en `users` y también un registro en `customers` con `customer_type = 'retail'` por defecto
**And** retorna `201 { data: { id, email, createdAt } }`

**Given** un admin autenticado asigna rol `wholesale` a un usuario mediante `POST /api/v1/users/:userId/roles`
**When** el rol queda asignado en `user_roles`
**Then** el campo `customer_type` del registro `customers` asociado se actualiza a `'wholesale'`

**Given** un usuario con rol `wholesale` autenticado
**When** hace `GET /api/v1/me`
**Then** retorna `200 { data: { id, email, roles, customer: { id, customerType } } }`

### Story 2.2: Creación de Pedido Mayorista

Como comprador mayorista autenticado,
quiero iniciar un pedido indicando el tipo de compra (curva o cantidad),
para que el sistema registre mi intención de compra con las reglas mayoristas correctas.

**Acceptance Criteria:**

**Given** un usuario autenticado con rol `wholesale`
**When** hace `POST /api/v1/orders` con `{ purchaseType: 'curva' | 'cantidad' }`
**Then** se crea un pedido en `orders` con `customer_id` del comprador, `status = 'pending'` y `total_amount = 0`
**And** retorna `201 { data: { id, customerId, purchaseType, status, createdAt } }`

**Given** un usuario con rol `wholesale` no envía `purchaseType`
**When** hace `POST /api/v1/orders`
**Then** retorna RFC 7807 `400` con detail indicando que `purchaseType` es obligatorio para compras mayoristas

**Given** un usuario autenticado sin rol `wholesale`
**When** hace `POST /api/v1/orders` con `purchaseType: 'curva'`
**Then** retorna RFC 7807 `403`

**Given** un usuario sin autenticación
**When** hace `POST /api/v1/orders`
**Then** retorna RFC 7807 `401`

### Story 2.3: Compra Mayorista por Curva

Como comprador mayorista autenticado,
quiero agregar un producto a mi pedido en modalidad curva (una unidad de cada variante disponible),
para que pueda comprar el set completo del producto en las cantidades que necesito.

**Acceptance Criteria:**

**Given** un pedido mayorista existente con `purchaseType = 'curva'` y un producto con variantes
**When** el mayorista dueño del pedido hace `POST /api/v1/orders/:orderId/items` con `{ productId, curves: N }`
**Then** el sistema identifica todas las variantes disponibles del producto
**And** valida que `stock.quantity >= N` para **cada** variante del producto
**And** si hay stock suficiente en todas: crea un `order_item` por cada variante con `quantity = N` y `unit_price = variant.retail_price` (copia histórica inmutable)
**And** descuenta `N` unidades del stock de cada variante dentro de una transacción atómica
**And** recalcula y actualiza `orders.total_amount`
**And** retorna `200 { data: { orderId, items: [...], totalAmount } }`

**Given** alguna variante del producto no tiene stock suficiente para `N` curvas
**When** se intenta agregar el producto al pedido
**Then** retorna RFC 7807 `422` con detail indicando cuál variante no tiene stock (talle + color + stock disponible)
**And** no se modifica ningún stock ni se crea ningún order_item (operación atómica — todo o nada)

**Given** el `orderId` pertenece a un usuario distinto al autenticado
**When** el mayorista intenta agregar ítems a ese pedido
**Then** retorna RFC 7807 `403`

**Given** un `productId` sin variantes registradas
**When** se intenta agregar al pedido en modalidad curva
**Then** retorna RFC 7807 `422` con detail indicando que el producto no tiene variantes disponibles

### Story 2.4: Compra Mayorista por Cantidad

Como comprador mayorista autenticado,
quiero indicar la cantidad total de unidades de un producto que quiero comprar sin estar atado a una variante específica,
para que pueda comprar en volumen con distribución libre de talles y colores según disponibilidad.

**Acceptance Criteria:**

**Given** un pedido mayorista con `purchaseType = 'cantidad'` y un producto con variantes que tienen stock
**When** el mayorista dueño del pedido hace `POST /api/v1/orders/:orderId/items` con `{ productId, quantity: N }`
**Then** el sistema suma el stock de **todas las variantes** del producto: `SUM(stock.quantity) para todas las variants del producto`
**And** valida que `stock_total_producto >= N`
**And** si hay stock total suficiente: crea un `order_item` por producto con `quantity = N`; el `unit_price` se calcula como el promedio ponderado de `retail_price` de las variantes disponibles (copia histórica)
**And** descuenta el stock proporcionalmente entre las variantes disponibles (de mayor a menor stock) dentro de una transacción atómica
**And** recalcula y actualiza `orders.total_amount`
**And** retorna `200 { data: { orderId, items: [...], totalAmount } }`

**Given** el stock total de todas las variantes del producto es menor a `N`
**When** se intenta agregar la cantidad solicitada
**Then** retorna RFC 7807 `422` con detail indicando el stock total disponible del producto y el desglose por variante
**And** no se modifica ningún stock ni se crea ningún order_item (operación atómica)

**Given** el `productId` no existe
**When** se intenta agregar al pedido
**Then** retorna RFC 7807 `404`

**Given** el `orderId` pertenece a un usuario distinto al autenticado
**When** el mayorista intenta agregar ítems a ese pedido
**Then** retorna RFC 7807 `403`

### Story 2.5: Consulta de Pedidos del Comprador Mayorista

Como comprador mayorista autenticado,
quiero ver todos mis pedidos y el detalle de cada uno,
para que pueda hacer seguimiento de mis compras y su estado actual.

**Acceptance Criteria:**

**Given** un mayorista autenticado con pedidos existentes
**When** hace `GET /api/v1/orders`
**Then** retorna `200 { data: [...], meta: { total } }` con todos los pedidos del comprador autenticado (solo los suyos)
**And** cada pedido incluye: `id`, `purchaseType`, `status`, `totalAmount`, `createdAt`

**Given** un mayorista autenticado
**When** hace `GET /api/v1/orders/:orderId` de un pedido que le pertenece
**Then** retorna `200 { data: { id, purchaseType, status, totalAmount, createdAt, items: [{ variantId, size, color, quantity, unitPrice }] } }`

**Given** el `orderId` pertenece a otro usuario
**When** el mayorista hace `GET /api/v1/orders/:orderId`
**Then** retorna RFC 7807 `403`

**Given** el mayorista no tiene pedidos
**When** hace `GET /api/v1/orders`
**Then** retorna `200 { data: [], meta: { total: 0 } }`

---

## Epic 3: Pagos con Mercado Pago (Mayoristas)

El mayorista puede pagar sus pedidos mediante Mercado Pago. El sistema procesa el resultado vía webhook y actualiza el estado del pedido automáticamente.

### Story 3.1: Checkout de Pago con Mercado Pago

Como comprador mayorista autenticado,
quiero iniciar el proceso de pago de mi pedido y recibir la URL del checkout de Mercado Pago,
para que pueda completar el pago de mi compra en la plataforma de pago.

**Acceptance Criteria:**

**Given** un pedido mayorista con `status = 'pending'` y `total_amount > 0`
**When** el dueño del pedido hace `POST /api/v1/payments/:orderId/checkout`
**Then** el sistema genera una orden de pago en Mercado Pago vía el SDK/API oficial
**And** registra el intento de pago con el ID externo de MP y `status = 'pending'`
**And** retorna `200 { data: { orderId, checkoutUrl, paymentId } }` con la URL del checkout de MP

**Given** un pedido con `total_amount = 0` o sin ítems
**When** se intenta iniciar el checkout
**Then** retorna RFC 7807 `422` indicando que el pedido no tiene monto para pagar

**Given** el `orderId` pertenece a otro usuario
**When** el mayorista intenta iniciar el checkout
**Then** retorna RFC 7807 `403`

**Given** un pedido ya en estado `paid`
**When** se intenta iniciar un nuevo checkout
**Then** retorna RFC 7807 `409` indicando que el pedido ya fue pagado

**Given** error en la API de Mercado Pago
**When** se intenta crear la orden de pago
**Then** el sistema responde RFC 7807 `502` con detail descriptivo; el pedido permanece en `status = 'pending'`

### Story 3.2: Procesamiento del Webhook de Mercado Pago

Como sistema,
quiero recibir y procesar las notificaciones de Mercado Pago sobre el resultado del pago,
para que el estado del pedido se actualice automáticamente sin intervención manual.

**Acceptance Criteria:**

**Given** Mercado Pago envía una notificación a `POST /api/v1/payments/webhook`
**When** la firma del webhook coincide con `MP_WEBHOOK_SECRET`
**Then** el sistema procesa el evento y actualiza el estado del pago y del pedido según el estado recibido

**Given** el estado del pago en el webhook es `approved`
**When** se procesa la notificación
**Then** el pedido asociado pasa a `status = 'paid'`
**And** el registro de pago actualiza su `status = 'approved'`, `paidAt` y `amount` confirmado

**Given** el estado del pago es `rejected`
**When** se procesa la notificación
**Then** el pedido pasa a `status = 'rejected'`
**And** el registro de pago actualiza su `status = 'rejected'`

**Given** el estado del pago es `pending`
**When** se procesa la notificación
**Then** el pedido permanece en `status = 'pending'`; no se realizan cambios adicionales

**Given** la firma del webhook no coincide con `MP_WEBHOOK_SECRET`
**When** llega una notificación a `POST /api/v1/payments/webhook`
**Then** el sistema responde `401` y descarta el evento sin procesar

**Given** se recibe un `paymentId` desconocido en el webhook
**When** se intenta actualizar el pedido
**Then** el sistema registra el error en el logger y responde `200` a Mercado Pago (para evitar reintentos infinitos)

---

## Epic 4: Compra Minorista con Pago

Un comprador minorista puede registrarse, comprar cualquier variante en cualquier cantidad y completar el pago con Mercado Pago. Flujo minorista completo end-to-end.

### Story 4.1: Compra Minorista — Pedido con Variante y Validación de Stock

Como comprador minorista autenticado,
quiero seleccionar una o más variantes de producto con su cantidad y crear un pedido,
para que pueda comprar exactamente lo que necesito con validación de stock garantizada.

**Acceptance Criteria:**

**Given** un usuario al que un admin le asigna rol `retail`
**When** el `customer_type` del Customer asociado se actualiza a `'retail'`
**Then** el usuario puede generar pedidos minoristas

**Given** un usuario con rol `retail` autenticado
**When** hace `POST /api/v1/orders` con `{ items: [{ variantId, quantity: N }] }`
**Then** el sistema valida que `stock.quantity >= N` para cada variante solicitada
**And** si hay stock: crea el pedido en `orders` con `customer_id` y `status = 'pending'`
**And** crea los `order_items` con `quantity` y `unit_price = variant.retail_price` (copia histórica)
**And** descuenta el stock de cada variante en una transacción atómica
**And** calcula `total_amount` como suma de `quantity * unit_price` por ítem
**And** retorna `201 { data: { id, status, totalAmount, items: [...] } }`

**Given** una variante no tiene stock suficiente para la cantidad solicitada
**When** se intenta crear el pedido
**Then** retorna RFC 7807 `422` con detail indicando qué variante no tiene stock (talle + color + disponible)
**And** no se modifica ningún stock ni se crea ningún pedido (operación atómica)

**Given** el request incluye un `variantId` inexistente
**When** se intenta crear el pedido
**Then** retorna RFC 7807 `404` indicando la variante no encontrada

**Given** un usuario sin rol `retail` o `wholesale`
**When** intenta hacer `POST /api/v1/orders`
**Then** retorna RFC 7807 `403`

### Story 4.2: Consulta de Pedidos del Comprador Minorista

Como comprador minorista autenticado,
quiero ver mis pedidos y su estado actual,
para que pueda hacer seguimiento de mis compras.

**Acceptance Criteria:**

**Given** un minorista autenticado con pedidos existentes
**When** hace `GET /api/v1/orders`
**Then** retorna `200 { data: [...], meta: { total } }` con todos sus pedidos (solo los suyos)
**And** cada pedido incluye: `id`, `status`, `totalAmount`, `createdAt`

**Given** un minorista autenticado
**When** hace `GET /api/v1/orders/:orderId` de un pedido propio
**Then** retorna `200 { data: { id, status, totalAmount, createdAt, items: [{ variantId, size, color, quantity, unitPrice }] } }`

**Given** el `orderId` pertenece a otro usuario
**When** el minorista hace `GET /api/v1/orders/:orderId`
**Then** retorna RFC 7807 `403`

### Story 4.3: Pago Minorista con Mercado Pago

Como comprador minorista autenticado,
quiero pagar mi pedido con Mercado Pago y que el sistema procese el resultado automáticamente,
para que mi compra quede confirmada sin pasos manuales.

**Acceptance Criteria:**

**Given** un pedido minorista con `status = 'pending'` y `total_amount > 0`
**When** el dueño del pedido hace `POST /api/v1/payments/:orderId/checkout`
**Then** el sistema genera la orden en Mercado Pago y retorna `200 { data: { orderId, checkoutUrl, paymentId } }`

**Given** Mercado Pago notifica `approved` al webhook con el `paymentId` del pedido minorista
**When** la firma del webhook es válida
**Then** el pedido minorista pasa a `status = 'paid'`
**And** el registro de pago se actualiza con `paidAt` y `amount`

**Given** Mercado Pago notifica `rejected`
**When** la firma del webhook es válida
**Then** el pedido pasa a `status = 'rejected'`

_Nota: el endpoint de checkout y el webhook son los mismos que en la Épica 3 — el flujo de pago ya soporta pedidos de cualquier tipo. Esta story valida que funciona correctamente también para pedidos minoristas._

---

## Epic 5: Escalabilidad y Operación _(diferida — Fase F)_

El sistema soporta carga real de producción con caché Redis, rate limiting y sesiones optimizadas. Se implementa cuando el sistema esté en producción y se identifiquen necesidades reales de escala.

### Story 5.1: Caché de Catálogo con Redis

Como visitante o comprador,
quiero que el catálogo de productos responda con baja latencia incluso bajo alta concurrencia,
para que la experiencia de navegación sea fluida en producción.

**Acceptance Criteria:**

**Given** Redis está activo en Docker Compose
**When** se hace `GET /api/v1/products`
**Then** el resultado se cachea en Redis con TTL configurable (default: 5 minutos)

**Given** el catálogo está cacheado y un admin modifica un producto
**When** se completa el `PUT /api/v1/products/:id` o `POST /api/v1/products/:id/variants`
**Then** el cache de productos se invalida para forzar recarga en el próximo request

**Given** Redis no está disponible
**When** se hace cualquier request al catálogo
**Then** el sistema responde normalmente desde PostgreSQL (Redis como caché opcional, no bloqueante)

### Story 5.2: Rate Limiting

Como sistema,
quiero limitar la cantidad de requests por IP en un período de tiempo,
para que el sistema esté protegido ante abuso o ataques de fuerza bruta.

**Acceptance Criteria:**

**Given** un cliente hace más de N requests por minuto al mismo endpoint (N configurable en `.env`)
**When** supera el límite
**Then** el sistema responde RFC 7807 `429` con `Retry-After` en headers

**Given** los endpoints de auth (`/auth/login`, `/auth/register`)
**When** se aplica rate limiting
**Then** tienen un límite más estricto que el resto de la API

### Story 5.3: Refresh Tokens

Como comprador autenticado,
quiero que mi sesión se renueve automáticamente sin tener que hacer login nuevamente,
para que mi experiencia de uso sea continua durante jornadas largas de trabajo.

**Acceptance Criteria:**

**Given** el access token de 24h expiró
**When** el cliente envía el refresh token a `POST /api/v1/auth/refresh`
**Then** el sistema emite un nuevo access token sin requerir credenciales

**Given** el refresh token es inválido o fue revocado
**When** se intenta usar
**Then** retorna RFC 7807 `401` y el cliente debe hacer login nuevamente

---

---
## Épicas Web & Mobile — jedami-web + jedami-mobile

> **Estrategia de integración secuencial:**
> Cada épica BFF (1–5) tiene stories web/mobile que se implementan **después** de que el backend
> correspondiente está completo. El frontend siempre consume la API real — sin mocks.
>
> **Flujo por feature:**
> 1. Dev implementa la story BFF → endpoints disponibles y testeados
> 2. Story WEB/MOBILE pasa a `ready-for-dev` → Dev integra contra el API real
>
> **Convención de story keys:**
> - `X-N-descripcion` → story de backend jedami-bff (se implementa primero)
> - `web-X-N-descripcion` → story de frontend jedami-web (después del BFF)
> - `mobile-X-N-descripcion` → story de admin mobile jedami-mobile (después del BFF)

---

## Épica 1 Web: Setup del Design System y Catálogo Público

El frontend web queda operativo con el design system JEDAMI, el catálogo público navegable y el flujo de autenticación.

### Story W1.1: Setup de jedami-web — Design System JEDAMI

Como desarrollador,
quiero configurar jedami-web con Vue 3 + shadcn-vue + Tailwind y los design tokens JEDAMI,
para que todos los componentes siguientes se construyan sobre una base visual consistente.

**Acceptance Criteria:**

**Given** el proyecto `jedami-web` está inicializado (Vue 3 + Vite + TypeScript)
**When** se ejecuta el servidor de desarrollo
**Then** se muestra una página con la paleta de colores JEDAMI, tipografía Nunito y el `ModeIndicator` funcional en modo `retail`

**Given** el design system está configurado
**When** se cambia `data-mode` en `<html>` de `retail` a `wholesale`
**Then** el acento de color cambia de magenta `#E91E8C` a azul `#1565C0` y el `ModeIndicator` refleja el cambio

**Given** el setup está completo
**When** se ejecutan los checks de CI (`npm run type-check && npm run build`)
**Then** compila sin errores

**Tareas técnicas:**
- Instalar y configurar shadcn-vue + Tailwind CSS
- Definir design tokens en `tailwind.config.ts`: colores JEDAMI, tipografía Nunito
- Configurar CSS variables para modo retail/wholesale
- Crear componente `<ModeIndicator>` en `src/components/features/catalog/ModeIndicator.vue`
- Configurar cliente Axios en `src/api/client.ts` con interceptor JWT (puede apuntar a MSW en dev)
- Configurar MSW (Mock Service Worker) para desarrollo offline/paralelo
- Crear `src/stores/auth.store.ts` (Pinia) esqueleto
- Setup de layout base: `<AppLayout>` con header persistente

**No paralelizable con:** nada — puede arrancar en día 1

---

### Story W1.2: Páginas de Login y Registro

Como visitante,
quiero poder registrarme e iniciar sesión en la plataforma,
para que pueda acceder a las funcionalidades de compra.

**Acceptance Criteria:**

**Given** el usuario completa el formulario de registro con email, password y tipo de cliente
**When** hace submit
**Then** se llama `POST /api/v1/auth/register`, el token se almacena en `authStore` y es redirigido al catálogo

**Given** credenciales incorrectas en el login
**When** la API retorna 401
**Then** se muestra el mensaje de error RFC 7807 bajo el formulario (no un alert del browser)

**Given** el usuario está autenticado
**When** recarga la página
**Then** el token persiste (localStorage) y el usuario no debe volver a hacer login

**Tareas técnicas:**
- Crear `src/views/LoginView.vue` y `src/views/RegisterView.vue`
- Implementar `authStore.login()` y `authStore.register()` con Axios
- Interceptor JWT en `src/api/client.ts`: agrega `Authorization: Bearer {token}` automáticamente
- Redireccionamiento post-login según rol (admin → /admin, wholesale → /catalogo, retail → /catalogo)
- Form patterns del UX spec: validación on-blur, spinner inline en submit, password toggle
- Integrar componente `<SoftRegistrationGate>` (Sheet de shadcn-vue) para J4

**Paralelizable con:** Story 1.2-bff (usar MSW mock de `POST /auth/register` y `POST /auth/login`)

---

### Story W1.3: Catálogo Público — ProductCard + VariantSelector + StockMatrix

Como visitante o comprador,
quiero ver el catálogo de productos con sus variantes, precios y estados de stock,
para que pueda explorar la oferta y decidir qué comprar.

**Acceptance Criteria:**

**Given** productos con variantes disponibles en la API
**When** el usuario entra a `/catalogo`
**Then** se muestra una grilla de `ProductCard` (4 cols desktop / 2 tablet / 2 mobile) con nombre, precio, swatches de color y badge de stock

**Given** el usuario hace hover sobre una `ProductCard`
**When** la card tiene una segunda imagen definida
**Then** la imagen hace swap (hover image swap)

**Given** el usuario hace click en una card
**When** entra al detalle del producto
**Then** ve la galería de fotos, el `VariantSelector` (color + talle) y la `StockMatrix` talle×color

**Given** una variante no tiene stock (`quantity = 0`)
**When** se muestra en el `VariantSelector`
**Then** el botón de talle aparece tachado y con `aria-disabled=true` (no seleccionable)

**Given** query param `?mode=wholesale` en la URL
**When** el `ModeIndicator` está en modo wholesale
**Then** el label de precio cambia a "Precio mayorista" y el badge del header muestra "🏭 Mayorista"

**Tareas técnicas:**
- Crear `src/components/features/catalog/ProductCard.vue` con hover image swap, swatches, stock badge, talles disponibles
- Crear `src/components/features/catalog/VariantSelector.vue` con estado de stock por variante
- Crear `src/components/features/catalog/StockMatrix.vue` con colores disponible/bajo/agotado
- Crear `src/views/CatalogView.vue` con paginación "Cargar más"
- Crear `src/views/ProductView.vue` con galería + selector + acciones según rol
- Implementar `productsStore` (Pinia) con `fetchCatalog()` y `fetchProduct(id)`
- Implementar paginación: `?page=N&pageSize=20`
- Skeleton loaders animados mientras carga el catálogo

**Paralelizable con:** Stories 1.4-bff y 1.5-bff (usar MSW mock de `GET /products`)

---

### Story W1.4: Panel de Administración — CRUD de Productos

Como administrador autenticado,
quiero gestionar el catálogo de productos (crear, editar, agregar variantes y stock),
para que el catálogo refleje la oferta real de la tienda.

**Acceptance Criteria:**

**Given** el admin está autenticado
**When** entra a `/admin/productos`
**Then** ve la lista de todos los productos con botones de editar y agregar variante

**Given** el admin hace click en "Nuevo producto"
**When** completa el form y lo guarda
**Then** se llama `POST /api/v1/products` y el producto aparece en la lista

**Given** el admin agrega una variante a un producto
**When** completa `{ size, color, retailPrice, initialStock }` y guarda
**Then** se llama `POST /api/v1/products/:id/variants` y la variante aparece en el detalle

**Given** un usuario sin rol admin intenta acceder a `/admin/productos`
**When** Vue Router evalúa el guard
**Then** es redirigido al catálogo con mensaje de acceso denegado

**Tareas técnicas:**
- Crear `src/views/admin/ProductsAdminView.vue` con tabla de productos
- Crear `src/views/admin/ProductFormView.vue` con form de creación/edición
- Crear componente `<VariantFormDialog>` (Dialog de shadcn-vue) para agregar variantes
- Implementar guard de ruta `requireRole('admin')` en Vue Router
- Implementar `adminProductsStore` (Pinia) con CRUD completo

**Paralelizable con:** Stories 1.3-bff, 1.4-bff y 1.5-bff

---

## Épica 1 Mobile: Setup Admin Flutter

### Story M1.1: Setup de jedami-mobile — App Admin Flutter

Como desarrollador,
quiero configurar jedami-mobile como app de administración con Flutter + go_router + Riverpod + Dio,
para que el administrador pueda gestionar el catálogo desde su dispositivo móvil.

**Acceptance Criteria:**

**Given** la app está configurada
**When** se ejecuta `flutter run -d chrome`
**Then** muestra la pantalla de login con el branding JEDAMI (Material 3 con colores de marca)

**Given** el admin hace login exitoso
**When** la API retorna el JWT con rol admin
**Then** el token se almacena y el admin es redirigido a la pantalla principal del catálogo

**Tareas técnicas:**
- Configurar `go_router` con rutas: `/login`, `/admin/productos`, `/admin/productos/:id`
- Configurar cliente Dio en `lib/core/api/client.dart` con interceptor JWT
- Crear `AuthNotifier` con Riverpod para manejo de estado de autenticación
- Configurar `AuthProvider` (Riverpod) con token en `SharedPreferences`
- Crear pantalla `LoginScreen` con form Material 3 JEDAMI themed
- Configurar `MaterialApp.router` con el tema de marca JEDAMI

**No paralelizable con:** Story 1.2-bff en cuanto a la API — pero la app UI puede armarse antes

---

### Story M1.2: Admin Panel Productos Mobile

Como administrador con la app móvil,
quiero crear y gestionar productos con variantes directamente desde mi celular,
para que pueda actualizar el catálogo desde el depósito sin necesitar la computadora.

**Acceptance Criteria:**

**Given** el admin está autenticado en la app
**When** entra a la pantalla de productos
**Then** ve la lista de productos con nombre y cantidad de variantes

**Given** el admin toca "Nuevo producto"
**When** completa el formulario y guarda
**Then** se llama `POST /api/v1/products` y el producto aparece en la lista

**Given** el admin toca una variante y actualiza el stock
**When** guarda los cambios
**Then** el stock se actualiza via API y la pantalla refleja el nuevo valor

**Tareas técnicas:**
- Crear pantalla `ProductsScreen` con `ListView.builder` y `Riverpod` AsyncValue
- Crear pantalla `ProductFormScreen` con form para crear/editar producto
- Crear `VariantFormSheet` (BottomSheet) para agregar variantes
- Implementar `ProductsNotifier` (Riverpod) con CRUD

**Paralelizable con:** Stories 1.4-bff y 1.5-bff

---

## Épica 2 Web: Compra Mayorista

### Story W2.1: Registro Mayorista y Perfil Customer

Como comprador mayorista,
quiero registrarme indicando que soy mayorista y ver mi perfil de comprador,
para que pueda generar pedidos mayoristas con las reglas correctas.

**Acceptance Criteria:**

**Given** el formulario de registro tiene un selector de "Tipo de cliente"
**When** el usuario elige "Soy mayorista" y completa el registro
**Then** el `authStore` registra al usuario y el `ModeIndicator` cambia a modo wholesale automáticamente

**Given** el mayorista está logueado
**When** accede a `/perfil`
**Then** ve `{ email, roles, customer: { id, customerType: 'wholesale' } }` con el badge "Mayorista"

**Paralelizable con:** Story 2.1-bff

---

### Story W2.2: Checkout Mayorista — CurvaCalculator y Compra por Cantidad

Como comprador mayorista autenticado,
quiero elegir el tipo de compra (curva o cantidad) y ver el resumen calculado antes de confirmar,
para que pueda hacer pedidos mayoristas con precisión y eficiencia.

**Acceptance Criteria:**

**Given** el mayorista está en el detalle de un producto en modo wholesale
**When** selecciona "Comprar por curva" e ingresa N=3 curvas
**Then** el `CurvaCalculator` muestra en tiempo real: talle 2: 3uds, talle 3: 3uds, ... total: X uds, total: $Y

**Given** alguna variante del producto no tiene stock suficiente
**When** el CurvaCalculator la evalúa
**Then** esa variante se muestra en rojo con el texto "Sin stock suficiente" y se excluye del total

**Given** el mayorista selecciona "Comprar por cantidad" e ingresa N=50 unidades
**When** el stock total del producto es >= 50
**Then** el sistema muestra la distribución proporcional estimada por variante antes de confirmar

**Tareas técnicas:**
- Crear `src/components/features/catalog/CurvaCalculator.vue` con input reactivo
- Crear vista de detalle en modo wholesale con selector de tipo de compra (curva/cantidad)
- Implementar `ordersStore` (Pinia) con `createOrder()` y `addItemCurva()`
- Mostrar resumen del pedido mayorista antes del checkout

**Paralelizable con:** Stories 2.2-bff, 2.3-bff, 2.4-bff

---

### Story W2.3: Mis Pedidos — Vista Mayorista

Como comprador mayorista autenticado,
quiero ver el historial de mis pedidos con su estado y detalle,
para que pueda hacer seguimiento de mis compras.

**Acceptance Criteria:**

**Given** el mayorista está autenticado
**When** accede a `/pedidos`
**Then** ve la lista de sus pedidos con status, totalAmount y purchaseType (curva/cantidad)

**Given** el mayorista toca un pedido
**When** entra al detalle
**Then** ve todos los items con variante (talle + color), cantidad y unitPrice

**Paralelizable con:** Story 2.5-bff

---

## Épica 3 Web: Pagos con Mercado Pago

### Story W3.1: Botón de Pago y Confirmación

Como comprador,
quiero pagar mi pedido con Mercado Pago desde la interfaz web,
para que pueda completar mi compra sin salir de la experiencia de jedami.

**Acceptance Criteria:**

**Given** el comprador tiene un pedido en estado `pending`
**When** toca "Pagar con Mercado Pago"
**Then** se llama `POST /api/v1/payments/:orderId/checkout` y es redirigido a la `checkoutUrl` de MP

**Given** Mercado Pago redirige de vuelta con `?status=approved`
**When** el usuario llega a `/pedidos/:orderId/confirmacion`
**Then** ve un resumen del pedido con estado "Pagado" y un CTA "Seguir comprando"

**Given** Mercado Pago redirige con `?status=rejected`
**When** el usuario llega a la página de confirmación
**Then** ve un Dialog con opciones: "Reintentar pago" o "Cancelar pedido"

**Paralelizable con:** Stories 3.1-bff y 3.2-bff

---

## Épica 4 Web: Compra Minorista + Gate de Registro

### Story W4.1: Compra Minorista y Soft Registration Gate

Como visitante o minorista,
quiero seleccionar una variante y comprarla, con un registro contextual si no tengo cuenta,
para que la experiencia de compra sea simple y sin fricciones innecesarias.

**Acceptance Criteria:**

**Given** un visitante sin cuenta en el detalle de un producto
**When** toca "Comprar"
**Then** aparece un `Sheet` (bottom sheet) con opciones "Crear cuenta gratis" e "Iniciar sesión"

**Given** el visitante completa el registro desde el bottom sheet
**When** se registra exitosamente
**Then** el flujo continúa automáticamente desde donde estaba (el item sigue seleccionado)

**Given** el minorista está autenticado
**When** selecciona color + talle y toca "Comprar"
**Then** se crea el pedido y es redirigido al checkout de Mercado Pago

**Paralelizable con:** Stories 4.1-bff y 4.2-bff

---

### Story W4.2: Mis Pedidos — Vista Minorista

Como comprador minorista autenticado,
quiero ver mis pedidos con su estado de pago,
para que pueda hacer seguimiento de mis compras minoristas.

**Acceptance Criteria:**

**Given** el minorista está autenticado
**When** accede a `/pedidos`
**Then** ve sus pedidos con status (pending/paid/rejected) y totalAmount

**Paralelizable con:** Story 4.2-bff

---

## Tabla de Dependencias — Flujo Secuencial BFF → Frontend

| Story Web/Mobile | Se desbloquea cuando... |
|---|---|
| **W1.1** Setup Vue + design system | BFF story 1.1 done |
| **M1.1** Setup Flutter admin | BFF story 1.1 done |
| **W1.2** Auth pages | BFF story 1.2 done |
| **W1.3** Catálogo público | BFF stories 1.4 + 1.5 done |
| **W1.4** Admin panel products | BFF stories 1.3 + 1.4 done |
| **M1.2** Admin panel mobile | BFF story 1.4 done |
| **W2.1** Registro mayorista | BFF story 2.1 done |
| **W2.2** CurvaCalculator checkout | BFF stories 2.2 + 2.3 + 2.4 done |
| **W2.3** Mis pedidos mayorista | BFF story 2.5 done |
| **W3.1** Checkout + confirmación | BFF stories 3.1 + 3.2 done |
| **W4.1** Compra minorista + gate | BFF story 4.1 done |
| **W4.2** Mis pedidos minorista | BFF story 4.2 done |
