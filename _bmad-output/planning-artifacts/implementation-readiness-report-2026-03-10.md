# Implementation Readiness Assessment Report

**Date:** 2026-03-10
**Project:** tienda-jedami

---

## Document Inventory

### PRD
- `_bmad-output/planning-artifacts/prd.md` ✅

### Architecture
- `_bmad-output/planning-artifacts/architecture.md` ✅

### Epics & Stories
- `_bmad-output/planning-artifacts/epics.md` ✅

### UX Design
- No encontrado ℹ️ (esperado — proyecto backend API, sin UI propia)

### Documentos adicionales
- `_bmad-output/planning-artifacts/product-brief.md` ✅ (referencia)

---

## PRD Analysis

### Functional Requirements

RF-01: Registro de Usuarios — `POST /auth/register`; bcrypt; email único; 201 sin exponer password
RF-02: Autenticación JWT — `POST /auth/login`; verifica hash; retorna JWT 24h con id y roles
RF-03: Gestión de Roles — roles admin/retail/wholesale; consultables y creables por admin
RF-04: Asignación de Roles — admin asigna roles; múltiples roles por usuario; efecto inmediato
RF-05: RBAC — middleware JWT + rol; 401 sin token; 403 sin rol requerido
RF-06: Gestión de Productos con Variantes — CRUD admin; variante = talle + color + retail_price; stock por variant_id
RF-07: Visualización pública del catálogo — sin auth; variantes + precio según mode=retail|wholesale; paginación
RF-08: Creación de Pedidos — asociado a customer_id; order_items con variant_id + quantity + unit_price (histórico); estado inicial pending
RF-09: Modalidades de Venta — modo visualización (contexto tienda) ≠ modo compra (rol usuario)
RF-10: Compra Mayorista — solo rol wholesale; requiere purchase_type antes de crear pedido
RF-10.1: Compra por Curva — tipo=curva; 1 unidad de cada variante; N curvas; valida stock por variante >= N
RF-10.2: Compra por Cantidad — tipo=cantidad; quantity=N; valida suma stock todas las variantes del producto >= N
RF-10.3: Selección del Tipo de Compra — campo purchase_type: curva|cantidad; 400 si no se especifica en compra mayorista
RF-11: Validación de Stock atómica — transaccional; sin reducir stock hasta confirmar; 422 con detalle del fallo
RF-12: Integración Mercado Pago — checkout (`POST /payments/:orderId/checkout`); webhook (`POST /payments/webhook`); estados approved/rejected/pending; registro histórico

**Total FRs: 15**

### Non-Functional Requirements

RNF-01: Seguridad — bcrypt salt ≥ 10; JWT 24h; middleware en rutas sensibles; validación firma webhook MP; nunca exponer password_hash
RNF-02: Persistencia y Consistencia — PostgreSQL; FK enforced; transacciones atómicas en stock + pedidos; sin estados inconsistentes
RNF-03: Arquitectura en capas — API → Dominio → Infraestructura; TypeScript estricto; módulo wholesale encapsulado con contrato explícito
RNF-04: Escalabilidad — Open/Closed; nuevos medios de pago sin modificar lógica de pedidos; nuevas modalidades sin refactorizaciones masivas
RNF-05: Mantenibilidad — código legible, modular; nombres descriptivos; ESLint consistente
RNF-06: Modularidad del módulo wholesale — lógica curva y cantidad encapsulada; integración por contrato con core de pedidos
RNF-07: Tiempo real desacoplado — bus de eventos interno preparado, activación progresiva en Fase F; no afecta REST API

**Total NFRs: 7**

### Additional Requirements (del PRD)

- Precio vive en variante (`retail_price`), no en producto
- Stock es 1-1 con variante (`variant_id` es PK en tabla `stock`)
- `customers` separado de `users` — perfil comercial con `customer_type`
- `order_items.unit_price` es copia histórica del precio al momento de compra (inmutable)
- Visitante puede navegar catálogo sin registrarse (RF-09, Journey 0)
- RN-08: visualización de precios no requiere registro
- RN-09: registro solo requerido para generar pedidos

### PRD Completeness Assessment

✅ PRD completo y bien estructurado
✅ Todos los RFs tienen criterios de aceptación verificables
✅ NFRs con criterios medibles
✅ Glosario cubre todos los términos del dominio
✅ Journeys cubren todos los flujos relevantes (incluyendo visitante no registrado)
✅ Fases A-F priorizadas por valor de negocio

---

## Epic Coverage Validation

### Coverage Matrix

| RF | Texto PRD | Cobertura en Épicas | Estado |
|---|---|---|---|
| RF-01 | Registro de Usuarios | Épica 1 Story 1.2 / Épica 2 Story 2.1 / Épica 4 Story 4.1 | ✅ Cubierto |
| RF-02 | Autenticación JWT | Épica 1 Story 1.2 | ✅ Cubierto |
| RF-03 | Gestión de Roles | Épica 1 Story 1.3 | ✅ Cubierto |
| RF-04 | Asignación de Roles | Épica 1 Story 1.3 / Épica 2 Story 2.1 / Épica 4 Story 4.1 | ✅ Cubierto |
| RF-05 | RBAC | Épica 1 Story 1.3 | ✅ Cubierto |
| RF-06 | Gestión de Productos con Variantes | Épica 1 Story 1.4 | ✅ Cubierto |
| RF-07 | Visualización pública del catálogo | Épica 1 Story 1.5 | ✅ Cubierto |
| RF-08 | Creación de Pedidos | Épica 2 Stories 2.2/2.3/2.4 / Épica 4 Story 4.1 | ✅ Cubierto |
| RF-09 | Modalidades de Venta | Épica 2 Story 2.2 / Épica 4 Story 4.1 | ✅ Cubierto |
| RF-10 | Compra Mayorista (general) | Épica 2 Story 2.2 | ✅ Cubierto |
| RF-10.1 | Compra por Curva | Épica 2 Story 2.3 | ✅ Cubierto |
| RF-10.2 | Compra por Cantidad | Épica 2 Story 2.4 | ✅ Cubierto |
| RF-10.3 | Selección del Tipo de Compra | Épica 2 Story 2.2 | ✅ Cubierto |
| RF-11 | Validación de Stock atómica | Épica 2 Stories 2.3/2.4 / Épica 4 Story 4.1 | ✅ Cubierto |
| RF-12 | Integración Mercado Pago | Épica 3 Stories 3.1/3.2 / Épica 4 Story 4.3 | ✅ Cubierto |

### Missing Requirements

Ninguno.

### Coverage Statistics

- Total PRD FRs: 15
- FRs cubiertos en épicas: 15
- **Cobertura: 100%** ✅

---

## UX Alignment Assessment

### UX Document Status

No encontrado — esperado y justificado. El scope del proyecto en esta fase es el **backend API (`jedami-bff`)** exclusivamente. `jedami-web` y `jedami-mobile` son proyectos separados que consumen la API.

### Alignment Issues

Ninguno. El PRD define los journeys del usuario (Journey 0 al 4) que sirven como especificación UX de alto nivel suficiente para el backend.

### Warnings

ℹ️ **No bloqueante:** Si en el futuro se desarrolla `jedami-web` o `jedami-mobile` dentro de este monorepo como feature, se recomienda crear un documento UX antes de comenzar las épicas de frontend. Por ahora no aplica.

---

## Epic Quality Review

### Checklist por Épica

| Criterio | Épica 1 | Épica 2 | Épica 3 | Épica 4 | Épica 5 |
|---|---|---|---|---|---|
| Entrega valor de usuario | ✅ | ✅ | ✅ | ✅ | ✅ |
| Funciona de forma independiente | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stories bien dimensionadas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sin dependencias hacia adelante | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tablas creadas cuando se necesitan | ✅ | ⚠️ | ✅ | ✅ | — |
| ACs en Given/When/Then | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trazabilidad a RFs | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 🔴 Violaciones Críticas

**Ninguna.** No se encontraron épicas técnicas sin valor de usuario, ni dependencias hacia adelante entre stories.

---

### 🟠 Issues Mayores

**Issue M-01 — Story 2.4: Ambigüedad en RF-10.2 (Compra por Cantidad)**

La Story 2.4 implementa la compra por cantidad con `{ variantId, quantity: N }` — es decir, el mayorista elige una **variante específica** (talle + color). Sin embargo, el PRD (RF-10.2) dice:

> "La compra por cantidad requiere stock total suficiente del **producto**"

Y el Journey 4 del PRD dice:

> "Selecciona producto + define cantidad total de unidades"

**Contradicción:** ¿La compra por cantidad es sobre una variante específica o sobre el producto en su totalidad (eligiendo distribución libre entre variantes)?

- Si es por variante específica → la story actual es correcta pero el PRD debe actualizarse
- Si es por producto con distribución libre → la story necesita rediseñarse con `{ productId, quantity: N }` y distribución opcional por variante

**Recomendación:** Requiere decisión explícita del Product Owner antes de implementar Story 2.4.

---

**Issue M-02 — Story 2.1: Precondición de tablas confusa**

El AC de Story 2.1 dice `Given las tablas customers, orders y order_items existen`, pero es esta misma story la que debería crearlas (o disparar su migración). Esto crea una precondición circular.

**Recomendación:** Clarificar distribución de migraciones:
- Story 2.1 → migración crea tabla `customers`
- Story 2.2 → migración crea tabla `orders`
- Story 2.3 ó 2.4 → migración crea tabla `order_items` (o junto con `orders` en Story 2.2)

---

### 🟡 Concerns Menores

**Issue m-01 — Story 1.1: Título técnico**
"Infraestructura Base del Proyecto" es un título técnico. Sin embargo, está correctamente ubicada como Story 1.1 *dentro* de una épica de valor de usuario, no como una épica técnica independiente. Aceptable bajo los estándares del workflow.

**Issue m-02 — Story 1.3: Seed de roles no especificado**
El AC dice "When se ejecuta el seed de roles" pero no especifica si es una migración SQL, un script separado, o lógica en el startup del servidor. Un agente de dev podría tener ambigüedad.
**Recomendación:** Especificar que el seed se ejecuta como parte de la migración inicial (archivo SQL).

**Issue m-03 — Story 4.3: Historia de validación, no de implementación**
Story 4.3 valida que el flujo de pago de Épica 3 funciona para pedidos minoristas. No agrega nueva funcionalidad al backend — el endpoint de checkout y el webhook son exactamente los mismos. Es una story de QA/validación más que de implementación.
**Recomendación:** Conservarla como checklist de prueba, no como story de implementación. O fusionarla con una nota en Stories 3.1/3.2.

---

### Resumen de Calidad

| Severidad | Cantidad | Bloqueante |
|---|---|---|
| 🔴 Crítico | 0 | — |
| 🟠 Mayor | 2 | M-01 requiere decisión del PO |
| 🟡 Menor | 3 | No bloqueantes |

---

## Summary and Recommendations

### Overall Readiness Status

## ✅ LISTO PARA IMPLEMENTACIÓN — todos los issues resueltos

El proyecto tienda-jedami tiene una planificación sólida. PRD, Arquitectura y Épicas están alineados. La cobertura de requerimientos es del 100%. No hay violaciones críticas de calidad en las épicas.

**Un único issue mayor (M-01) requiere una decisión explícita del Product Owner antes de implementar Story 2.4**, pero no bloquea las demás stories de implementación.

---

### Critical Issues Requiring Immediate Action

**1. ~~Decisión de negocio — RF-10.2 Compra por Cantidad (Issue M-01)~~ — ✅ RESUELTO**

PO eligió **Opción B**: `POST /orders/:orderId/items` con `{ productId, quantity: N }`. El sistema valida stock total sumando todas las variantes del producto y descuenta proporcionalmente.

Story 2.4, RF-10.2 y Journey 4 actualizados en epics.md y prd.md.

---

### Recommended Next Steps

1. **Resolver Issue M-01:** Tomar la decisión sobre RF-10.2 (Opción A o B) y actualizar Story 2.4 y el PRD con la definición exacta.

2. **Corregir precondición en Story 2.1 (Issue M-02):** Aclarar en los ACs que Story 2.1 crea la tabla `customers`, Story 2.2 crea `orders`, y ambas crean `order_items` (o Story 2.2 incluye la migración completa de orders + order_items).

3. **Especificar el seed de roles en Story 1.3 (Issue m-02):** Indicar que el seed de roles `admin/retail/wholesale` se ejecuta como parte de la migración SQL inicial (archivo `migrations/seed-roles.sql` o similar).

4. **Reconsiderar Story 4.3 (Issue m-03):** Evaluar si convertirla en un checklist de QA en lugar de una story de implementación, dado que no agrega código nuevo al backend.

5. **Proceder con Sprint Planning:** Una vez resuelto el Issue M-01, ejecutar `/bmad-bmm-sprint-planning` para generar el plan de sprints desde la Épica 1.

---

### Final Note

Esta evaluación identificó **5 issues en 3 categorías**:

- 0 críticos — no hay bloqueantes absolutos
- 2 mayores — M-01 requiere decisión del PO antes de Story 2.4; M-02 es corrección menor de redacción
- 3 menores — mejoras de claridad sin impacto en la implementación

**Las Épicas 1, 2 (Stories 2.1–2.3 y 2.5), 3, y 4 (Stories 4.1–4.2) pueden comenzar a implementarse inmediatamente.** Story 2.4 y Story 4.3 esperan resolución de M-01.

---

_Reporte generado: 2026-03-10 | Proyecto: tienda-jedami | Evaluador: Winston (Arquitecto BMAD) + Marceloo_
