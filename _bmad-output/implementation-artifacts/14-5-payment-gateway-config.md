# Story 14.5: Extraer `payment_gateway` de `branding` a Configuración General

Status: backlog

## Contexto

`branding.payment_gateway` es una columna que no tiene nada que ver con el branding visual (nombre de tienda, colores, logo). Está ahí porque fue agregada como parche rápido en migration 025. Conceptualmente es configuración del sistema, igual que `purchase_types` y `customer_types`.

Además es un string libre sin constraint — cualquier valor puede insertarse sin error.

## Story

Como desarrollador,
quiero que `payment_gateway` viva en una tabla de configuración del sistema con valores válidos controlados,
para que no contamine la tabla `branding` y sea extensible sin migrations.

## Acceptance Criteria

1. **Given** la migración se ejecuta
   **When** finaliza
   **Then** existe una tabla `system_config(key, value, updated_at)` con la fila `payment_gateway = 'checkout_pro'` (o el valor actual)
   **And** `branding.payment_gateway` está eliminado

2. **Given** el BFF lee la configuración del gateway
   **When** llama al endpoint o función interna
   **Then** lee de `system_config` en lugar de `branding`

3. **Given** el admin cambia el gateway desde el panel
   **When** guarda el cambio
   **Then** actualiza `system_config` con `key = 'payment_gateway'`

4. **Given** se intenta guardar un gateway inválido
   **When** el BFF valida el valor
   **Then** retorna 400 si no es `checkout_pro` o `checkout_api`

## Tasks / Subtasks

### Migration `0XX_system_config.sql`
- [ ] Crear tabla `system_config`:
  ```sql
  CREATE TABLE system_config (
    key        VARCHAR(50) PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Migrar valor existente de branding
  INSERT INTO system_config (key, value)
  SELECT 'payment_gateway', payment_gateway
  FROM branding
  LIMIT 1;

  -- Eliminar columna de branding
  ALTER TABLE branding DROP COLUMN IF EXISTS payment_gateway;
  ```

### BFF — adaptar lectura del gateway
- [ ] `payments.service.ts` / `config.controller.ts`: cambiar query de `SELECT payment_gateway FROM branding` a:
  ```sql
  SELECT value FROM system_config WHERE key = 'payment_gateway'
  ```

- [ ] `GET /config` endpoint: agregar `paymentGateway` leyendo de `system_config`

### BFF — adaptar escritura del gateway
- [ ] Handler de update del gateway:
  ```sql
  INSERT INTO system_config (key, value, updated_at)
  VALUES ('payment_gateway', $1, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  ```

### WEB — sin cambios
El frontend ya recibe `paymentGateway` como parte de `GET /config` — no necesita saber de dónde viene.

## Dev Notes

### `system_config` como tabla key-value
Es el patrón más simple para configuración del sistema que no encaja en tablas tipadas. Claves conocidas actuales:
- `payment_gateway`: `checkout_pro` | `checkout_api`

Claves futuras posibles:
- `maintenance_mode`: `true` | `false`
- `min_wholesale_amount`: `5000`
- `max_items_per_order`: `100`

### Validación en BFF, no en DB
El tipo de dato es `TEXT`, sin CHECK constraint. La validación de valores permitidos se hace en el handler BFF al recibir el PATCH. Así agregar un nuevo gateway válido no requiere migration.

### Cache de `system_config`
Si ya existe cache en Redis para `GET /config`, asegurarse de invalidarlo al actualizar `payment_gateway` en `system_config`.

### Referencias
- [Source: jedami-bff/src/database/migrations/025_payment_gateway.sql]
- [Source: jedami-bff/src/modules/config/config.controller.ts]
- [Source: jedami-bff/src/modules/payments/payments.service.ts]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
