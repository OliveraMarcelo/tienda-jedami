# Arquitectura de Módulos Verticales

## Visión

La plataforma no está pensada solo para indumentaria. El objetivo es soportar múltiples rubros de negocio (ferreterías, librerías, almacenes, restaurantes, etc.) mediante un **core compartido** y **módulos verticales** que se activan por tienda.

Este modelo es similar al de plataformas como Odoo o Shopify: un núcleo sólido y extensiones que se enchufan según el tipo de negocio.

---

## Estructura general

```
CORE (siempre presente)
├── stores / tenants
├── users, auth, roles
├── orders, payments
├── categories
└── branding, config

MÓDULOS VERTICALES (se activan por store)
├── module_clothing     → talles, colores, variantes, curva/cantidad
├── module_hardware     → atributos técnicos, medidas, unidades
├── module_grocery      → stock por peso/litro, vencimientos, proveedores
└── module_restaurant   → menú, modificadores, mesas
```

---

## Multi-tenancy

Cada negocio es un `store`. Una tabla en el core controla qué módulos tiene habilitados:

```sql
CREATE TABLE stores (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(100) UNIQUE NOT NULL,  -- "ferreteria-pepe"
  name        VARCHAR(255) NOT NULL,
  plan        VARCHAR(50) DEFAULT 'free',    -- free / pro / enterprise
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE store_modules (
  store_id    INT REFERENCES stores(id),
  module      VARCHAR(50) NOT NULL,   -- 'clothing', 'hardware', 'grocery', 'restaurant'
  enabled_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (store_id, module)
);
```

Todas las tablas del core llevan `store_id` para aislar la data entre negocios.

---

## Módulos definidos

### module_clothing (implementado actualmente)

Lo que ya existe en el sistema: talles, colores, variantes con stock, compra por curva y por cantidad.

```sql
clothing_sizes    (id, store_id, label, sort_order, deleted_at)
clothing_colors   (id, store_id, name, hex_code, deleted_at)
clothing_variants (id, product_id, size_id, color_id, stock, price_retail, price_wholesale, deleted_at)
```

Lógica exclusiva: soft-delete de talles/colores, compra por curva, compra por cantidad, reordenamiento de imágenes.

---

### module_hardware

Para ferreterías, corralones, distribuidoras de materiales.

```sql
hardware_attributes     (id, store_id, name)
-- Ej: "medida", "material", "rosca", "tensión"

hardware_variant_attrs  (variant_id, attribute_id, value)
-- Ej: tornillo → medida: M6, material: acero, rosca: métrica

hardware_units          (id, store_id, label, divisible)
-- Ej: "unidad", "caja x100", "metro", "kg"
```

---

### module_grocery

Para almacenes, kioscos, distribuidoras, mayoristas de alimentos.

```sql
grocery_variants  (id, product_id, unit, stock_qty, expires_at, supplier_id)
grocery_suppliers (id, store_id, name, contact, cuit)
```

Lógica exclusiva: control de vencimientos, compra por peso/litro, gestión de proveedores.

---

### module_restaurant

Para restaurantes, bares, cafeterías, delivery.

```sql
restaurant_sections   (id, store_id, name, sort_order)
-- Ej: "Entradas", "Platos principales", "Postres", "Bebidas"

restaurant_modifiers  (id, product_id, name, options JSONB)
-- Ej: { "Sin cebolla": 0, "Extra queso": 150 }

restaurant_tables     (id, store_id, number, capacity)
```

---

## Estructura BFF

```
src/modules/
├── core/
│   ├── products/       ← producto base (nombre, descripción, categoría)
│   ├── orders/
│   ├── payments/
│   └── auth/
│
└── verticals/
    ├── clothing/       ← módulo actual
    │   ├── clothing.routes.ts
    │   ├── clothing.controller.ts
    │   └── queries/
    ├── hardware/
    ├── grocery/
    └── restaurant/
```

Los módulos verticales registran sus rutas solo si están habilitados para el store:

```typescript
// app.ts
const activeModules = await getStoreModules(storeId)

if (activeModules.includes('clothing'))    app.use('/api/v1', clothingRoutes)
if (activeModules.includes('hardware'))    app.use('/api/v1', hardwareRoutes)
if (activeModules.includes('grocery'))     app.use('/api/v1', groceryRoutes)
if (activeModules.includes('restaurant'))  app.use('/api/v1', restaurantRoutes)
```

---

## Relación con el schema actual

Las tablas actuales `sizes`, `colors`, `variants`, `product_prices` pertenecen conceptualmente a `module_clothing`. El `core` solo conoce `products` (nombre, descripción, categoría, precio base). La lógica de variantes, talles y colores es responsabilidad del módulo.

---

## Hoja de ruta para implementar

1. Agregar tabla `stores` + `store_id` en tablas core
2. Agregar tabla `store_modules`
3. Refactorizar tablas actuales de indumentaria bajo el namespace `clothing_*`
4. Implementar módulos adicionales según demanda de clientes
