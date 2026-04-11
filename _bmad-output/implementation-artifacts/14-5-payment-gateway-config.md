# Story 14.5: Extraer `payment_gateway` de `branding` a Configuración General

Status: obsolete

> **OBSOLETA — Supersedida por Story 17-1 (`17-1-multiples-medios-pago-por-tipo-cliente`)**
>
> El objetivo central de esta story era separar la configuración de medios de pago de la tabla `branding`. Story 17-1 implementó una solución más completa: la tabla `payment_gateway_rules` (migración `040_payment_gateway_rules.sql`) que permite configurar qué gateways están activos **por tipo de cliente** (`retail` / `wholesale`). Esta tabla vive fuera de `branding` y es gestionable desde el panel admin sin deploy.
>
> El campo `branding.payment_gateway` se mantiene como fallback en `resolveActiveGateways()` (en `payments.service.ts`): si no hay ninguna regla configurada para un `customer_type`, se usa el gateway global de `branding` como compatibilidad hacia atrás.
>
> La idea de la tabla `system_config` key-value queda descartada en favor del diseño tipado de `payment_gateway_rules`.

## Contexto original (referencia histórica)

`branding.payment_gateway` era una columna que no tiene nada que ver con el branding visual (nombre de tienda, colores, logo). Estaba ahí porque fue agregada como parche rápido en migration 025. Conceptualmente es configuración del sistema.

## Solución implementada (story 17-1)

- **Tabla:** `payment_gateway_rules(id, customer_type, gateway, active, updated_at)` — migración `040`
- **Seed inicial:** migración `043` habilita `checkout_pro` y `bank_transfer` para `retail` y `wholesale` por defecto
- **API:** `GET /api/v1/config/payment-gateways` y `PATCH /api/v1/config/payment-gateways`
- **Lógica en BFF:** `resolveActiveGateways(customerType)` en `payments.service.ts`:
  1. Lee `payment_gateway_rules` WHERE `customer_type = $1 AND active = TRUE`
  2. Si hay reglas activas → úsalas
  3. Si no hay ninguna regla para el type → fallback a `branding.payment_gateway`
  4. Si hay reglas pero todas inactivas → 422 "Sin medios de pago disponibles"

## Estado de `branding.payment_gateway`

La columna sigue existiendo en `branding` como campo de fallback. No es necesario eliminarla ni moverla a otra tabla dado el contexto actual. Si en el futuro se desea hacer limpieza definitiva, se puede eliminar una vez que todos los tenants (Epic 12) tengan sus propias reglas en `payment_gateway_rules`.

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
