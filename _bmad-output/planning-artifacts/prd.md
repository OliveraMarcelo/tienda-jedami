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
**Estado:** Fase 1 – Definición

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
| **Usuario** | Persona registrada en el sistema que puede comprar |
| **Admin** | Usuario con permisos de administración del sistema |
| **Cliente Minorista** | Usuario que compra en modalidad minorista (por unidad) |
| **Cliente Mayorista** | Usuario que compra en modalidad mayorista (volumen) |
| **Rol** | Conjunto de permisos asignados a un usuario |
| **Producto** | Artículo disponible para la venta |
| **Variante** | Versión de un producto (ej: talle S, M, L, XL) |
| **Curva** | Modalidad de compra mayorista: una unidad de cada talle disponible del producto |
| **Compra por cantidad** | Modalidad de compra mayorista: cantidad total de unidades sin distribución por talle forzada |
| **Pedido** | Registro de una compra realizada por un usuario |
| **Stock** | Cantidad de unidades disponibles de un producto o variante |
| **Pago** | Transacción financiera asociada a un pedido |
| **Webhook** | Notificación HTTP enviada por Mercado Pago al sistema sobre el resultado de un pago |

### 2.2 Reglas de Negocio Clave

| ID | Regla |
|---|---|
| RN-01 | Un usuario puede tener uno o más roles asignados simultáneamente |
| RN-02 | Solo usuarios con rol Mayorista pueden comprar en modalidad mayorista |
| RN-03 | La compra por curva requiere stock suficiente en **cada talle** disponible del producto |
| RN-04 | La compra por cantidad requiere stock total suficiente del producto |
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

#### Cliente Minorista
- **Descripción:** Comprador individual, compra en pequeñas cantidades
- **Motivación:** Acceder al catálogo y comprar de manera simple y segura
- **Necesidades:**
  - Registrarse e iniciar sesión
  - Ver productos disponibles
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
  → GET /products (visualiza catálogo)
  → Selecciona producto + define cantidad total de unidades
  → POST /orders con tipo = "cantidad", quantity = N
  → Sistema valida: ¿hay stock total suficiente?
  → Si OK: crea pedido (distribución de talles libre o posterior)
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
- [ ] `GET /products/:id` — consulta un producto específico
- [ ] Un producto puede tener variantes (ej: talles S, M, L, XL) con stock individual por variante
- [ ] Retorna 404 si el producto no existe
- [ ] Retorna 403 si el usuario no es admin e intenta crear/modificar

**Prioridad:** Alta — MVP

---

### RF-07 — Visualización de Productos

**Descripción:** Los usuarios autenticados pueden visualizar el catálogo de productos disponibles.

**Criterios de aceptación:**
- [ ] `GET /products` retorna lista de productos disponibles
- [ ] Incluye nombre, descripción, precio y variantes (talles + stock)
- [ ] Disponible para todos los usuarios autenticados
- [ ] Soporta paginación básica

**Prioridad:** Alta — MVP

---

### RF-08 — Creación de Pedidos (General)

**Descripción:** Los usuarios pueden generar pedidos de compra.

**Criterios de aceptación:**
- [ ] `POST /orders` crea un pedido asociado al usuario autenticado
- [ ] El pedido registra: usuario, productos, cantidades, modalidad (minorista/mayorista), estado inicial `pending`
- [ ] El sistema valida stock antes de confirmar el pedido
- [ ] Retorna 201 con el pedido creado
- [ ] Retorna 422 si no hay stock suficiente

**Prioridad:** Alta — MVP

---

### RF-09 — Modalidades de Venta (Minorista / Mayorista)

**Descripción:** El sistema diferencia las reglas de compra según la modalidad del cliente.

**Criterios de aceptación:**
- [ ] La modalidad minorista permite comprar cualquier cantidad de cualquier producto
- [ ] La modalidad mayorista aplica reglas específicas (ver RF-10.x)
- [ ] La modalidad se determina por el rol del usuario autenticado
- [ ] Las reglas de validación (precio, mínimos, stock) difieren según modalidad

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

**Descripción:** Permite al mayorista comprar una cantidad total de unidades de un producto, sin distribución forzada por talle.

**Criterios de aceptación:**
- [ ] El pedido se genera con `tipo = "cantidad"` y `quantity = N`
- [ ] El sistema valida: `stock_total_producto >= N`
- [ ] La distribución de talles puede ser libre o definida por el usuario (a determinar en implementación)
- [ ] Retorna 422 si no hay stock total suficiente

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

### 7.1 Dentro del Alcance — Fase 1

- API REST completa con autenticación JWT
- Gestión de usuarios y roles (RBAC)
- Gestión de productos con variantes
- Sistema de pedidos con modalidades minorista y mayorista
- Compra mayorista por curva y por cantidad
- Validación de stock (por talle y total)
- Integración completa con Mercado Pago (checkout + webhook)
- Infraestructura preparada para tiempo real (desacoplada)
- PostgreSQL como base de datos

### 7.2 Fuera del Alcance — Fase 1

- Frontend / interfaz de usuario
- Gestión de envíos y logística
- Facturación electrónica
- Notificaciones push / email
- Integración con pasarelas de pago adicionales (solo Mercado Pago)
- Panel de administración web

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
| Un producto puede tener variantes (talles) desde el inicio | Cambio en el modelo de datos de productos |
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
