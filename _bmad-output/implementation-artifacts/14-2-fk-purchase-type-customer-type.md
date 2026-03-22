# Story 14.2: FK Real para `purchase_type` y `customer_type`

Status: backlog

## Contexto

`orders.purchase_type` y `customers.customer_type` tienen CHECK constraints hardcodeadas con valores que ya existen en las tablas de referencia `purchase_types` y `customer_types`. Si el admin agrega un nuevo tipo en esas tablas, los CHECKs no lo permiten — las dos capas están desincronizadas.

## Story

Como desarrollador,
quiero que `orders.purchase_type` y `customers.customer_type` sean FKs reales a sus tablas de referencia,
para que agregar un nuevo tipo en la tabla de configuración lo habilite automáticamente en todo el sistema sin tocar constraints.

## Acceptance Criteria

1. **Given** la migración se ejecuta
   **When** finaliza
   **Then** `orders.purchase_type` tiene FK a `purchase_types.code`
   **And** `customers.customer_type` tiene FK a `customer_types.code`
   **And** los CHECK constraints hardcodeados están eliminados

2. **Given** el admin agrega un nuevo `purchase_type` en la tabla de configuración
   **When** se crea un pedido con ese tipo
   **Then** la DB lo acepta sin errores de constraint

3. **Given** se intenta insertar un `purchase_type` que no existe en `purchase_types`
   **When** la DB procesa el INSERT
   **Then** falla con violación de FK (comportamiento correcto)

4. **Given** todos los datos existentes en `orders` y `customers`
   **When** se ejecuta la migración
   **Then** todos los registros existentes satisfacen la nueva FK (no hay datos huérfanos)

## Tasks / Subtasks

- [ ] **Verificación previa**: confirmar que todos los valores existentes en `orders.purchase_type` están en `purchase_types.code` y todos los de `customers.customer_type` en `customer_types.code`
  ```sql
  -- Debe retornar 0 filas
  SELECT DISTINCT purchase_type FROM orders
  WHERE purchase_type NOT IN (SELECT code FROM purchase_types);

  SELECT DISTINCT customer_type FROM customers
  WHERE customer_type NOT IN (SELECT code FROM customer_types);
  ```

- [ ] **Migration `0XX_fk_purchase_customer_types.sql`**:
  ```sql
  -- Eliminar CHECK constraints hardcodeadas
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_purchase_type_check;
  ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_customer_type_check;

  -- Agregar FK a tablas de referencia
  ALTER TABLE orders
    ADD CONSTRAINT orders_purchase_type_fk
    FOREIGN KEY (purchase_type) REFERENCES purchase_types(code)
    ON UPDATE CASCADE;

  ALTER TABLE customers
    ADD CONSTRAINT customers_customer_type_fk
    FOREIGN KEY (customer_type) REFERENCES customer_types(code)
    ON UPDATE CASCADE;
  ```

- [ ] Verificar que el BFF no tenga validaciones duplicadas de `purchase_type` en código que deban actualizarse

## Dev Notes

### `ON UPDATE CASCADE`
Si el código de un tipo cambia en la tabla de referencia, se propaga automáticamente a todas las filas que lo referencian. Raramente pasa, pero es la opción más segura.

### Sin `ON DELETE` restrictivo
No usar `ON DELETE CASCADE` ni `ON DELETE RESTRICT` excesivo — los tipos de referencia no se deberían eliminar si tienen registros asociados (Postgres lo rechazará por FK de todas formas).

### Nombres de constraints existentes
Los nombres exactos de los CHECK constraints pueden variar. Verificar con:
```sql
SELECT conname FROM pg_constraint
WHERE conrelid = 'orders'::regclass AND contype = 'c';

SELECT conname FROM pg_constraint
WHERE conrelid = 'customers'::regclass AND contype = 'c';
```

### Referencias
- [Source: jedami-bff/src/database/migrations/006_customers_orders.sql]
- [Source: jedami-bff/src/database/migrations/008_retail_orders.sql]
- [Source: jedami-bff/src/database/migrations/015_reference_tables.sql]
- [Source: jedami-bff/src/database/migrations/018_config_tables.sql]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
