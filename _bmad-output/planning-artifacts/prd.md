---
stepsCompleted: [discovery, vision, executive-summary, success, journeys, domain, scoping, functional, nonfunctional, polish]
inputDocuments:
  - docs/01-requerimientos/requerimientos.md
  - _bmad-output/planning-artifacts/product-brief.md
workflowType: prd
date: 2026-03-09
author: Marceloo
---

# Product Requirements Document (PRD)
# Tienda Online Mayorista y Minorista — Backend API

**Autor:** Marceloo
**Fecha:** 2026-03-09
**Versión:** 1.0
**Estado:** Definición — Fases A–F priorizadas por valor de negocio

---

## Resumen Ejecutivo

Este documento define los requerimientos del producto para el **backend de una tienda online** que opera en modalidad mayorista y minorista. El sistema expondrá una API REST construida en Node.js + TypeScript, con persistencia en PostgreSQL, autenticación basada en JWT, control de acceso por roles, gestión de productos y pedidos, validación de stock y pago integrado mediante Mercado Pago.

El diferenciador central del sistema es su capacidad de gestionar dos modalidades de venta con reglas distintas dentro de una misma plataforma, con una arquitectura modular y extensible que permite agregar nuevas funcionalidades sin afectar las existentes.

---

## 1. Visión del Producto

### 1.1 Problema que Resuelve

Los negocios con operación dual (mayorista + minorista) deben manejar reglas de negocio complejas y diferenciadas por tipo de cliente: precios distintos, mínimos de compra, formas de compra específicas (curva vs. cantidad) y validaciones de stock particulares. Sin un sistema diseñado para esto, el backend se vuelve frágil, acoplado e imposible de mantener.

### 1.2 Propuesta de Valor

Una API backend unificada que:
- Gestiona usuarios con múltiples roles de forma nativa
- Soporta la dualidad de compra mayorista/minorista sin comprometer la arquitectura
- Integra pagos reales desde el primer día
- Está diseñada para crecer: tiempo real, nuevos medios de pago, nuevas modalidades

### 1.3 Objetivos del Producto

| Objetivo | Indicador |
|---|---|
| Soporte completo de operación minorista | Flujo registro → compra → pago operativo |
| Soporte completo de operación mayorista | Ambas modalidades (curva/cantidad) con validación de stock |
| Seguridad | Autenticación JWT + RBAC implementados |
| Pagos | Integración Mercado Pago end-to-end (checkout + webhook) |
| Calidad de código | Separación de capas; módulo mayorista independiente |

---

## 2. Contexto del Dominio

### 2.1 Glosario del Dominio

| Término | Definición |
|---|---|
| **Visitante** | Persona no registrada que puede navegar el catálogo y ver precios según el modo activo de la tienda |
| **Usuario** | Persona registrada en el sistema que puede comprar |
| **Admin** | Usuario con permisos de administración del sistema |
| **Cliente Minorista** | Usuario que compra en modalidad minorista (por unidad) |
| **Cliente Mayorista** | Usuario que compra en modalidad mayorista (volumen) |
| **Rol** | Conjunto de permisos asignados a un usuario |
| **Modo de la tienda** | Contexto activo de la tienda (minorista o mayorista) que determina qué precios se muestran, independientemente de si el visitante está registrado |
| **Producto** | Artículo disponible para la venta |
| **Customer** | Perfil comercial de un comprador, separado de la cuenta de autenticación (`User`). Tiene `customer_type` (retail/wholesale) y se asocia a los pedidos |
| **Variante** | Versión de un producto con combinación específica de **talle y color** (ej: Remera Oversize – Negro – M). Cada variante tiene su propio precio (`retail_price`) y stock independiente |
| **Curva** | Modalidad de compra mayorista: una unidad de cada talle disponible del producto |
| **Compra por cantidad** | Modalidad de compra mayorista: cantidad total de unidades sin distribución por talle forzada |
| **Pedido** | Registro de una compra realizada por un usuario |
| **Stock** | Cantidad de unidades disponibles de una variante. El stock es 1-1 con la variante (`variant_id` es PK en la tabla `stock`) |
| **Pago** | Transacción financiera asociada a un pedido |
| **Webhook** | Notificación HTTP enviada por Mercado Pago al sistema sobre el resultado de un pago |

### 2.2 Reglas de Negocio Clave

| ID | Regla |
|---|---|
| RN-01 | Un usuario puede tener uno o más roles asignados simultáneamente |
| RN-02 | Solo usuarios con rol Mayorista pueden **comprar** en modalidad mayorista |
| RN-08 | La visualización de precios (minorista o mayorista) no requiere registro; el modo lo define el contexto de la tienda |
| RN-09 | El registro de usuario es requisito solo para generar pedidos, no para navegar el catálogo |
| RN-03 | La compra por curva requiere stock suficiente en **cada variante (talle + color)** disponible del producto |
| RN-04 | La compra por cantidad requiere stock total suficiente sumando todas las variantes del producto |
| RN-05 | Un pedido solo se considera pagado cuando Mercado Pago notifica estado exitoso |
| RN-06 | El módulo de lógica mayorista debe estar encapsulado e independiente del core |
| RN-07 | El sistema debe permitir agregar nuevos medios de pago sin modificar la lógica de pedidos |

---

## 3. Usuarios y Roles

### 3.1 Perfiles de Usuario

#### Administrador
- **Descripción:** Usuario con acceso total al sistema de gestión
- **Motivación:** Mantener el catálogo, usuarios y operaciones del negocio bajo control
- **Necesidades:**
  - Crear, modificar y consultar productos
  - Gestionar usuarios y asignar roles
  - Visualizar estado de pedidos

#### Visitante
- **Descripción:** Persona no registrada que navega el catálogo
- **Motivación:** Ver precios y productos antes de decidir si comprar
- **Necesidades:**
  - Ver catálogo con precios según el modo activo de la tienda (minorista o mayorista)
  - No requiere registro para navegar

#### Cliente Minorista
- **Descripción:** Comprador individual, compra en pequeñas cantidades
- **Motivación:** Acceder al catálogo y comprar de manera simple y segura
- **Necesidades:**
  - Registrarse e iniciar sesión (solo para comprar)
  - Generar pedidos y pagar con Mercado Pago

#### Cliente Mayorista
- **Descripción:** Comprador en volumen con reglas especiales de compra
- **Motivación:** Adquirir productos en las cantidades y modalidades que le corresponden como mayorista
- **Necesidades:**
  - Seleccionar modalidad de compra (curva o cantidad)
  - Validar stock según la modalidad elegida
  - Pagar mediante Mercado Pago

---

## 4. Journeys del Usuario

### Journey 0: Navegación sin Registro (Visitante)

```
Visitante accede a la tienda
  → El modo de la tienda está activo (ej: modo minorista o mayorista)
  → GET /products (visualiza catálogo con precios del modo activo)
  → No requiere autenticación
  → Si intenta generar un pedido → el sistema solicita registro/login
```

### Journey 1: Registro e Inicio de Sesión

```
Usuario accede a la API
  → POST /auth/register (email + password)
  → Sistema crea el usuario con rol por defecto
  → POST /auth/login (email + password)
  → Sistema retorna JWT token
  → Usuario usa token en headers de solicitudes protegidas
```

### Journey 2: Compra Minorista

```
Cliente Minorista autenticado
  → GET /products (visualiza catálogo)
  → POST /orders (selecciona producto + cantidad)
  → Sistema valida stock disponible
  → POST /payments (inicia pago con Mercado Pago)
  → Sistema genera orden en Mercado Pago y retorna URL de checkout
  → Usuario completa pago en Mercado Pago
  → Mercado Pago notifica webhook al sistema
  → Sistema actualiza estado del pedido a "pagado"
```

### Journey 3: Compra Mayorista por Curva

```
Cliente Mayorista autenticado
  → GET /products (visualiza catálogo con variantes)
  → Selecciona producto con variantes (talles)
  → POST /orders con tipo = "curva"
  → Sistema valida: ¿hay stock en CADA talle disponible?
  → Si OK: crea pedido
  → Continúa flujo de pago (igual que Journey 2)
```

### Journey 4: Compra Mayorista por Cantidad

```
Cliente Mayorista autenticado
  → GET /products (visualiza catálogo con variantes y stock)
  → Selecciona producto + define cantidad total de unidades (sin elegir variante)
  → POST /orders/:orderId/items con { productId, quantity: N }
  → Sistema valida: SUM(stock de todas las variantes del producto) >= N
  → Si OK: crea order_items; descuenta stock proporcionalmente entre variantes
  → Continúa flujo de pago (igual que Journey 2)
```

---

## 5. Requerimientos Funcionales

### RF-01 — Registro de Usuarios

**Descripción:** El sistema permite registrar nuevos usuarios.

**Criterios de aceptación:**
- [ ] `POST /auth/register` acepta `email` y `password`
- [ ] La contraseña se almacena encriptada (bcrypt o equivalente)
- [ ] El sistema valida que el email no esté ya registrado
- [ ] Retorna 201 con datos básicos del usuario creado (sin exponer contraseña)
- [ ] Retorna 400 si el email ya existe o los datos son inválidos

**Prioridad:** Alta — MVP

---

### RF-02 — Autenticación

**Descripción:** El sistema permite a usuarios registrados iniciar sesión y obtener un token de acceso.

**Criterios de aceptación:**
- [ ] `POST /auth/login` acepta `email` y `password`
- [ ] El sistema verifica la contraseña contra el hash almacenado
- [ ] Retorna 200 con un JWT token válido
- [ ] El token incluye información del usuario (id, roles)
- [ ] Retorna 401 si las credenciales son incorrectas

**Prioridad:** Alta — MVP

---

### RF-03 — Gestión de Roles

**Descripción:** El sistema gestiona los roles disponibles en el sistema.

**Criterios de aceptación:**
- [ ] Existen al menos los roles: `admin`, `retail` (minorista), `wholesale` (mayorista)
- [ ] Los roles son consultables por un administrador
- [ ] El sistema permite crear nuevos roles (solo Admin)

**Prioridad:** Alta — MVP

---

### RF-04 — Asignación de Roles a Usuarios

**Descripción:** El sistema permite asignar uno o varios roles a un usuario.

**Criterios de aceptación:**
- [ ] Un Admin puede asignar roles a cualquier usuario
- [ ] Un usuario puede tener múltiples roles simultáneamente
- [ ] La asignación se refleja inmediatamente en los permisos del usuario
- [ ] Retorna 404 si el usuario o el rol no existen

**Prioridad:** Alta — MVP

---

### RF-05 — Autorización Basada en Roles (RBAC)

**Descripción:** El sistema restringe el acceso a funcionalidades según el rol del usuario autenticado.

**Criterios de aceptación:**
- [ ] Las rutas de administración (`/admin/*`) requieren rol `admin`
- [ ] Las rutas de compra mayorista requieren rol `wholesale`
- [ ] El middleware de autorización retorna 403 si el rol no corresponde
- [ ] El middleware retorna 401 si no hay token JWT válido

**Prioridad:** Alta — MVP

---

### RF-06 — Gestión de Productos

**Descripción:** El sistema permite crear, modificar y consultar productos.

**Criterios de aceptación:**
- [ ] `POST /products` — crea un producto (requiere rol `admin`)
- [ ] `PUT /products/:id` — modifica un producto (requiere rol `admin`)
- [ ] `GET /products/:id` — consulta un producto con todas sus variantes
- [ ] Un producto puede tener múltiples variantes; cada variante combina **talle + color** y tiene su propio `retail_price` y stock independiente
- [ ] Al crear/modificar variantes se especifican `size`, `color` y `retail_price`
- [ ] El stock se gestiona por variante (`variant_id` es PK de la tabla `stock`)
- [ ] Retorna 404 si el producto no existe
- [ ] Retorna 403 si el usuario no es admin e intenta crear/modificar

**Prioridad:** Alta — MVP

---

### RF-07 — Visualización de Productos

**Descripción:** Cualquier visitante puede visualizar el catálogo de productos con los precios del modo activo de la tienda, sin necesidad de registrarse.

**Criterios de aceptación:**
- [ ] `GET /products` retorna lista de productos disponibles **sin requerir autenticación**
- [ ] Cada producto incluye: nombre, descripción, y sus variantes (talle + color + `retail_price` + stock)
- [ ] El precio devuelto es `retail_price` de cada variante (precio de venta minorista base)
- [ ] El query param `mode=retail|wholesale` indica el contexto de la tienda; en Fase 1 se retorna `retail_price` en ambos modos (el precio mayorista es una extensión futura)
- [ ] Si no se especifica modo, el sistema retorna el precio minorista por defecto
- [ ] Soporta paginación básica

**Prioridad:** Alta — MVP

---

### RF-08 — Creación de Pedidos (General)

**Descripción:** Los usuarios pueden generar pedidos de compra.

**Criterios de aceptación:**
- [ ] `POST /orders` crea un pedido asociado al usuario autenticado (y su `Customer` asociado)
- [ ] El pedido registra: `customer_id`, variantes seleccionadas (no el producto directamente), cantidades, modalidad (minorista/mayorista), estado inicial `pending`
- [ ] Cada ítem del pedido (`order_items`) registra `variant_id`, `quantity` y `unit_price` (precio histórico al momento de la compra — copia de `retail_price` en ese instante)
- [ ] El sistema valida stock antes de confirmar el pedido
- [ ] Retorna 201 con el pedido creado
- [ ] Retorna 422 si no hay stock suficiente

**Prioridad:** Alta — MVP

---

### RF-09 — Modalidades de Venta (Minorista / Mayorista)

**Descripción:** El sistema diferencia la visualización de precios y las reglas de compra según la modalidad activa.

**Criterios de aceptación:**
- [ ] El **modo de visualización** (minorista/mayorista) lo determina el contexto de la tienda, no el rol del usuario
- [ ] Cualquier visitante puede ver precios en ambos modos sin registrarse
- [ ] La **modalidad de compra** (quién puede comprar en modo mayorista) sí la determina el rol del usuario autenticado
- [ ] La modalidad minorista permite comprar cualquier cantidad de cualquier producto
- [ ] La modalidad mayorista aplica reglas específicas (ver RF-10.x)
- [ ] Las reglas de validación (precio, mínimos, stock) difieren según modalidad de compra

**Prioridad:** Alta — MVP

---

### RF-10 — Compra Mayorista

**Descripción:** El sistema soporta las modalidades de compra específicas del cliente mayorista.

**Criterios de aceptación:**
- [ ] Solo disponible para usuarios con rol `wholesale`
- [ ] El usuario debe seleccionar el tipo de compra mayorista antes de generar el pedido
- [ ] Ver RF-10.1 (por curva) y RF-10.2 (por cantidad)

**Prioridad:** Alta — MVP

---

### RF-10.1 — Compra Mayorista por Curva

**Descripción:** Permite al mayorista comprar una unidad de cada talle disponible del producto.

**Criterios de aceptación:**
- [ ] El pedido se genera con `tipo = "curva"`
- [ ] El sistema identifica todos los talles disponibles del producto
- [ ] Una curva = 1 unidad de cada talle disponible
- [ ] El usuario puede comprar N curvas (cantidad de veces el set completo)
- [ ] El sistema valida: `stock_por_talle >= cantidad_curvas` para cada talle
- [ ] Retorna 422 si algún talle no tiene stock suficiente, indicando cuál

**Prioridad:** Alta — MVP

---

### RF-10.2 — Compra Mayorista por Cantidad

**Descripción:** Permite al mayorista comprar una cantidad total de unidades de un producto, sin distribución forzada por variante. El sistema valida el stock sumando todas las variantes del producto y descuenta proporcionalmente.

**Criterios de aceptación:**
- [ ] El pedido se genera con `tipo = "cantidad"`, `productId` y `quantity = N`
- [ ] El sistema valida: `SUM(stock.quantity de todas las variantes del producto) >= N`
- [ ] La distribución entre variantes la realiza el sistema automáticamente (de mayor a menor stock disponible)
- [ ] El `unit_price` registrado en `order_items` es el promedio ponderado de `retail_price` de las variantes disponibles (copia histórica)
- [ ] Retorna 422 si el stock total del producto es insuficiente, con desglose por variante
- [ ] Retorna 404 si el `productId` no existe

**Prioridad:** Alta — MVP

---

### RF-10.3 — Selección del Tipo de Compra Mayorista

**Descripción:** El sistema permite al mayorista elegir entre compra por curva o por cantidad.

**Criterios de aceptación:**
- [ ] El endpoint de pedidos acepta el campo `purchase_type` con valores `"curva"` | `"cantidad"`
- [ ] Si `purchase_type` no se especifica en una compra mayorista, el sistema retorna 400
- [ ] La lógica de validación varía según el tipo seleccionado

**Prioridad:** Alta — MVP

---

### RF-11 — Validación de Stock

**Descripción:** El sistema valida el stock disponible antes de confirmar cualquier pedido.

**Criterios de aceptación:**
- [ ] **Compra por curva:** valida `stock_por_talle >= cantidad_curvas` para cada talle del producto
- [ ] **Compra por cantidad:** valida `stock_total >= cantidad_solicitada`
- [ ] **Compra minorista:** valida `stock_disponible >= cantidad_solicitada`
- [ ] La validación es atómica (no se reduce el stock hasta confirmar el pedido)
- [ ] El sistema retorna mensaje descriptivo indicando qué producto/talle tiene stock insuficiente

**Prioridad:** Alta — MVP

---

### RF-12 — Integración con Mercado Pago

**Descripción:** El sistema integra Mercado Pago como medio de pago principal para pedidos minoristas y mayoristas.

**Criterios de aceptación:**

**Inicio del pago:**
- [ ] `POST /payments/:orderId/checkout` genera una orden de pago en Mercado Pago
- [ ] Retorna la URL del checkout de Mercado Pago para redirigir al usuario
- [ ] Aplica tanto a pedidos minoristas como mayoristas (curva y cantidad)

**Procesamiento del resultado:**
- [ ] El sistema expone un endpoint webhook `POST /payments/webhook` para recibir notificaciones de Mercado Pago
- [ ] Procesa correctamente los estados: `approved`, `rejected`, `pending`
- [ ] Solo marca el pedido como `paid` cuando el estado es `approved`

**Registro del pago:**
- [ ] Almacena: ID de pago de Mercado Pago, estado del pago, fecha y monto abonado
- [ ] El registro se asocia al pedido correspondiente

**Extensibilidad:**
- [ ] La integración de pago está abstraída detrás de una interfaz/servicio genérico
- [ ] Agregar un nuevo medio de pago no requiere modificar la lógica de pedidos

**Prioridad:** Alta — MVP

---

### RF-13 — Fotos de Productos

**Descripción:** Cada producto puede tener una o más imágenes que se muestran en el catálogo y en el detalle de producto.

**Criterios de aceptación:**
- [ ] Un Admin puede subir, reemplazar y eliminar imágenes de un producto
- [ ] Cada producto puede tener múltiples imágenes (al menos 1 principal)
- [ ] El catálogo (`GET /products`) incluye la URL de la imagen principal de cada producto
- [ ] El detalle (`GET /products/:id`) incluye todas las imágenes del producto
- [ ] Las imágenes se almacenan como URLs (almacenamiento externo: S3 compatible o local en dev)
- [ ] El sistema acepta imágenes en formatos JPG/PNG/WEBP
- [ ] Las imágenes son opcionales: productos sin imagen muestran un placeholder

**Prioridad:** Alta — Fase 2

---

### RF-14 — Precios Mayoristas por Variante

**Descripción:** Cada variante tiene un precio mayorista independiente del precio minorista, que se utiliza para mostrar precios y calcular totales en compras mayoristas.

**Criterios de aceptación:**
- [ ] La tabla `variants` incorpora el campo `wholesale_price` (NUMERIC, nullable)
- [ ] El Admin puede definir `wholesale_price` al crear o editar una variante
- [ ] `GET /products?mode=wholesale` retorna `wholesalePrice` en lugar de `retailPrice`
- [ ] La compra mayorista (curva y cantidad) usa `wholesale_price` como `unit_price` en `order_items`
- [ ] Si `wholesale_price` es null, el sistema usa `retail_price` como fallback
- [ ] El catálogo muestra la tabla de precios mayoristas diferenciada en modo wholesale

**Prioridad:** Alta — Fase 2

---

### RF-15 — Categorías de Productos

**Descripción:** Los productos se organizan en categorías para facilitar la navegación del catálogo.

**Criterios de aceptación:**
- [ ] Un Admin puede crear, editar y eliminar categorías
- [ ] Un producto pertenece a una categoría principal (relación N:1)
- [ ] `GET /products?category=:id` filtra el catálogo por categoría
- [ ] El catálogo incluye el campo `category` en cada producto
- [ ] El Admin puede reasignar la categoría de un producto existente
- [ ] Las categorías son opcionales: un producto puede no tener categoría asignada

**Prioridad:** Media — Fase 2

---

### RF-16 — Panel de Administración Avanzado

**Descripción:** El administrador dispone de un panel web con visualizaciones de negocio: ventas, pagos, gestión de productos y usuarios.

**Criterios de aceptación:**

**Dashboard:**
- [ ] Muestra métricas: total de pedidos, monto total vendido, pedidos por estado (pending/paid/rejected)
- [ ] Gráficos de ventas por período (diario/semanal/mensual)
- [ ] Los datos del dashboard se calculan en el BFF y se cachean en Redis

**Tabla de pagos:**
- [ ] El Admin puede ver todos los pagos con: orderId, monto, estado MP, fecha, tipo de compra
- [ ] Filtrable por estado y rango de fecha
- [ ] `GET /admin/payments` paginado, requiere rol `admin`

**Gestión de usuarios:**
- [ ] El Admin puede ver el listado de usuarios con su rol y fecha de registro
- [ ] El Admin puede buscar usuarios por email
- [ ] El Admin puede asignar/revocar roles desde la interfaz

**Prioridad:** Alta — Fase 2

---

### RF-17 — Branding Dinámico por Cliente

**Descripción:** La tienda soporta configuración de marca personalizable (colores, logo, nombre) para operar como plataforma whitelabel.

**Criterios de aceptación:**
- [ ] El BFF expone `GET /config/branding` que retorna: color primario, color secundario, logo URL, nombre de la tienda
- [ ] La configuración de branding se administra por variables de entorno o tabla de configuración en DB
- [ ] El frontend web y mobile leen el branding al iniciar y aplican los colores dinámicamente
- [ ] El cambio de branding no requiere redespliegue de la app (configuración hot-reload)

**Prioridad:** Media — Fase 2

---

### RF-18 — App Flutter Desktop — Gestión de Stock

**Descripción:** Una aplicación Flutter Desktop permite al operador gestionar el stock de productos sin acceso al panel web.

**Criterios de aceptación:**
- [ ] El operador puede iniciar sesión con sus credenciales (rol `admin`)
- [ ] Visualiza la lista de productos con stock por variante en tiempo real
- [ ] Puede ajustar el stock de cualquier variante manualmente (incrementar/decrementar)
- [ ] Las operaciones de stock se registran con timestamp y usuario que las realizó
- [ ] La app funciona en Linux Desktop y macOS
- [ ] Comparte el mismo BFF que la web y mobile

**Prioridad:** Media — Fase 2

---

## 6. Requerimientos No Funcionales

### RNF-01 — Seguridad

| Criterio | Especificación |
|---|---|
| Encriptación de contraseñas | bcrypt con salt rounds >= 10 |
| Autenticación | JWT con expiración configurada |
| Rutas protegidas | Middleware de autenticación en todas las rutas sensibles |
| Webhook de Mercado Pago | Validación de firma/secreto del webhook |

---

### RNF-02 — Persistencia y Consistencia

| Criterio | Especificación |
|---|---|
| Motor de base de datos | PostgreSQL |
| Integridad referencial | Constraints y foreign keys aplicados |
| Transacciones | Operaciones de pedido + stock deben ser atómicas |
| Resiliencia | El sistema debe recuperarse ante errores sin dejar datos en estado inconsistente |

---

### RNF-03 — Arquitectura

| Criterio | Especificación |
|---|---|
| Separación de capas | API (controladores/rutas) → Dominio (servicios/lógica) → Infraestructura (repositorios/DB) |
| Lenguaje | Node.js + TypeScript estricto |
| Patrón arquitectónico | Arquitectura en capas (Layered Architecture) o Clean Architecture |
| Módulo mayorista | Encapsulado en un módulo independiente con interfaz clara |

---

### RNF-04 — Escalabilidad

| Criterio | Especificación |
|---|---|
| Nuevas funcionalidades | No deben requerir modificar módulos existentes (Open/Closed Principle) |
| Nuevos medios de pago | Añadibles sin cambios en la lógica de pedidos |
| Nuevas modalidades de compra | El módulo mayorista debe soportar nuevos tipos sin refactorizaciones masivas |

---

### RNF-05 — Mantenibilidad

| Criterio | Especificación |
|---|---|
| Código | Legible, modular, con nombres descriptivos |
| Documentación | Funciones y módulos complejos documentados |
| Convenciones | Linting y formateo consistente en todo el proyecto |

---

### RNF-06 — Modularidad del Sistema

| Criterio | Especificación |
|---|---|
| Módulo mayorista | Lógica de venta mayorista en un módulo independiente |
| Tipos de compra mayorista | Soporte para múltiples tipos (curva, cantidad) sin acoplamiento |
| Interfaz del módulo | El módulo expone contratos claros consumidos por el core |

---

### RNF-07 — Capacidad de Procesamiento en Tiempo Real (Futuro)

| Criterio | Especificación |
|---|---|
| Infraestructura | El sistema debe estar preparado para incorporar tiempo real |
| Desacoplamiento | La capa de tiempo real no debe afectar el funcionamiento de la API REST |
| Casos de uso previstos | Actualización de stock, cambios de estado de pedidos, notificaciones de eventos |
| Activación | Progresiva, por módulos, en etapas posteriores |
| Tecnología | A definir en etapas posteriores del proyecto |

---

## 7. Alcance del Producto

> **Criterio de priorización:** El valor central del producto es la **gestión del catálogo con variantes** y la **compra mayorista en ambas modalidades**. El resto de funcionalidades se construye alrededor de ese núcleo.

### 7.1 Fases de Entrega

Las épicas y stories deben generarse **en este orden de prioridad**:

---

#### Fase A — Fundaciones Técnicas _(prerequisito, sin valor de negocio propio)_

| Incluye | RFs |
|---|---|
| Setup de base de datos, migraciones SQL iniciales (users, roles, products, variants, stock, orders, order_items, customers) | — |
| Pool `pg`, estructura de módulos, Docker Compose (BFF + PostgreSQL) | — |
| Middleware de error RFC 7807, logger pino, Swagger base | — |

**Objetivo:** Infraestructura lista para empezar a entregar valor.

---

#### Fase B — Catálogo de Productos con Variantes _(valor más alto — núcleo del negocio)_

| Incluye | RFs |
|---|---|
| CRUD de productos (admin) | RF-06 |
| Gestión de variantes: talle + color + `retail_price` | RF-06 |
| Gestión de stock por variante | RF-11 (parcial) |
| Visualización pública del catálogo con variantes y precio | RF-07 |
| Auth de admin mínima (JWT) para proteger el CRUD | RF-01, RF-02, RF-03, RF-04, RF-05 |

**Objetivo:** Admin puede cargar productos con variantes; el catálogo es consultable.

---

#### Fase C — Compra Mayorista _(valor más alto — diferenciador del negocio)_

| Incluye | RFs |
|---|---|
| Registro de compradores mayoristas (Customer) | RF-01, RF-04 |
| Creación de pedidos mayoristas | RF-08, RF-09 |
| Compra por curva (1 unidad de cada variante) | RF-10, RF-10.1, RF-10.3 |
| Compra por cantidad (total libre, sin distribución forzada) | RF-10.2, RF-10.3 |
| Validación de stock atómica por variante | RF-11 |
| Descuento de stock en transacción | RF-11 |

**Objetivo:** Un mayorista puede generar pedidos en cualquiera de las dos modalidades.

---

#### Fase D — Pago con Mercado Pago

| Incluye | RFs |
|---|---|
| Generación de checkout en Mercado Pago para pedidos mayoristas | RF-12 |
| Webhook: actualización de estado de pedido | RF-12 |
| Registro del pago (monto, estado, ID externo) | RF-12 |

**Objetivo:** El flujo de compra mayorista es end-to-end (pedido → pago → confirmación).

---

#### Fase E — Compra Minorista

| Incluye | RFs |
|---|---|
| Registro de clientes minoristas | RF-01, RF-04 |
| Pedidos minoristas (cualquier variante, cualquier cantidad) | RF-08, RF-09 |
| Pago minorista con Mercado Pago | RF-12 |

**Objetivo:** El flujo minorista completo queda operativo.

---

#### Fase F — Operación y Escalabilidad _(diferida)_

| Incluye | Notas |
|---|---|
| Rate limiting | `express-rate-limit` |
| Caché Redis para catálogo | Activar cliente `ioredis` |
| Refresh tokens | Si la sesión de 24h resulta insuficiente |
| Infraestructura para tiempo real | Bus de eventos interno (WebSocket / SSE) |

---

### 7.3 Desarrollo Paralelo: Backend y Frontend

El frontend (`jedami-web` — Vue 3 y `jedami-mobile` — Flutter) **se desarrolla en paralelo al backend a medida que cada épica del BFF queda lista**. El criterio de sincronía es:

| Épica Backend | Frontend puede arrancar |
|---|---|
| Épica 1 completa (catálogo + auth) | jedami-web: vistas de catálogo, login, registro; jedami-mobile: ídem |
| Épica 2 completa (compra mayorista) | jedami-web y mobile: flujo de pedido mayorista (curva + cantidad) |
| Épica 3 completa (pagos MP) | jedami-web y mobile: checkout y confirmación de pago |
| Épica 4 completa (compra minorista) | jedami-web y mobile: flujo de compra minorista completo |

**Requisito:** Las épicas de frontend deben tener su propio documento UX antes de comenzar. El usuario creará el UX Design (`/bmad-bmm-create-ux-design`) que servirá de base para las épicas de jedami-web y jedami-mobile.

### 7.4 Fuera del Alcance Permanente (Fase 1–E)

- Gestión de envíos y logística
- Facturación electrónica
- Notificaciones push / email
- Integración con pasarelas de pago adicionales (solo Mercado Pago)

> **Nota:** El Panel de Administración Web y la App Flutter Desktop fueron movidos al alcance en Fase 2 (ver RF-16, RF-18).

### 7.5 Fase G — Catálogo y Admin Avanzado _(nueva — Fase 2)_

| Incluye | RFs |
|---|---|
| Fotos de productos (imágenes múltiples por producto) | RF-13 |
| Precios mayoristas por variante (`wholesale_price`) | RF-14 |
| Categorías de productos | RF-15 |
| Seed data realista (talles 1–6, stock 20–30 por variante) | — |

**Objetivo:** El catálogo refleja fielmente el negocio real con imágenes, categorías y precios diferenciados.

### 7.6 Fase H — Panel Admin y Branding _(nueva — Fase 2)_

| Incluye | RFs |
|---|---|
| Dashboard de ventas con gráficos y métricas | RF-16 |
| Tabla de pagos y gestión de usuarios en el admin | RF-16 |
| Branding dinámico (whitelabel) | RF-17 |

**Objetivo:** El admin tiene visibilidad completa del negocio y la tienda puede funcionar como plataforma para múltiples clientes.

### 7.7 Fase I — App Desktop _(nueva — Fase 2)_

| Incluye | RFs |
|---|---|
| Flutter Desktop app para gestión de stock | RF-18 |

**Objetivo:** El operador puede gestionar stock desde una app nativa de escritorio sin necesidad del panel web.

---

## 8. Restricciones y Suposiciones

### Restricciones Técnicas

| Restricción | Detalle |
|---|---|
| Lenguaje | Node.js + TypeScript |
| Base de datos | PostgreSQL |
| Protocolo | HTTP/JSON (REST) |
| Medio de pago | Mercado Pago (único en Fase 1) |

### Suposiciones

| Suposición | Impacto si es incorrecta |
|---|---|
| Un producto puede tener variantes (talle + color) desde el inicio | Cambio en el modelo de datos de productos |
| El precio vive a nivel de variante (`retail_price`), no de producto | Cambio en las queries de catálogo y pedidos |
| `customers` es una entidad separada de `users` (perfil comercial vs cuenta auth) | Requiere diseño de relación users ↔ customers |
| `order_items.unit_price` almacena el precio histórico al momento de la compra | Cambio en lógica de creación de pedidos |
| Mercado Pago soporta los flujos mayoristas definidos | Posible ajuste en la implementación del checkout |
| El frontend es responsabilidad de un equipo/proyecto separado | Sin impacto en este PRD |

---

## 9. Dependencias

| Dependencia | Tipo | Detalle |
|---|---|---|
| Mercado Pago API | Externa | Integración para pagos y webhooks |
| PostgreSQL | Infraestructura | Base de datos relacional |
| Node.js + TypeScript | Tecnología | Stack de desarrollo |

---

## 10. Criterios de Completitud del PRD

Este PRD está completo cuando:
- [x] Todos los requerimientos funcionales tienen criterios de aceptación verificables
- [x] Los requerimientos no funcionales tienen criterios medibles
- [x] El glosario cubre todos los términos del dominio
- [x] Los journeys cubren todos los flujos de usuario relevantes
- [x] El alcance (in/out) está claramente delimitado
- [x] Las reglas de negocio están documentadas y trazables a RFs

---

_Este documento es la base para la creación de épicas, historias de usuario y planificación de sprints._
