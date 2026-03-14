# Story 6.2: Seed Data Realista (BFF)

Status: done

## Story

Como desarrollador,
quiero que los datos de prueba reflejen un negocio real de ropa de bebé mayorista,
para que las demos y los tests manuales sean representativos del uso real.

**Depende de:** Story 6.3 (wholesale_price), Story 6.4 (categorías)

## Acceptance Criteria

1. **Given** se corre `npm run migrate` en una DB vacía
   **Then** existen 5 productos con talles 1–6 (no rangos de edad)
   **And** cada variante tiene `retail_price` y `wholesale_price` (≈61% del retail)
   **And** el stock por variante está entre 20 y 30 unidades

2. **Given** se corre `npm run migrate`
   **Then** existen las 5 categorías: Remeras, Bodies, Pijamas, Pantalones, Conjuntos
   **And** cada producto tiene su `category_id` asignado

3. **Given** se corre `npm run migrate`
   **Then** cada producto tiene 2 fotos de ejemplo (URLs de Unsplash)

## Tasks

- [x] Reescribir `005_seed_products.sql`: 5 productos, talles 1–6, sin referencias a columnas de migraciones posteriores
- [x] Migración `013_seed_categories_and_wholesale.sql`: inserta categorías, asigna `category_id`, actualiza `wholesale_price`
- [x] Migración `014_seed_product_images.sql`: 2 fotos Unsplash por producto
