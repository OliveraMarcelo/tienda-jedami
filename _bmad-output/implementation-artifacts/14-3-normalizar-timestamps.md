# Story 14.3: Normalizar Timestamps a TIMESTAMPTZ

Status: backlog

## Contexto

`users.created_at` usa `TIMESTAMP` (sin timezone), mientras que todas las demás tablas del sistema usan `TIMESTAMPTZ`. Esta inconsistencia puede causar problemas silenciosos al comparar fechas entre tablas o al hacer queries con filtros de rango en distintos contextos de timezone.

## Story

Como desarrollador,
quiero que todos los campos de timestamp en la base de datos usen `TIMESTAMPTZ`,
para garantizar consistencia y evitar bugs de timezone en queries que cruzan tablas.

## Acceptance Criteria

1. **Given** la migración se ejecuta
   **When** finaliza
   **Then** `users.created_at` es `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   **And** todos los valores existentes se preservan (PostgreSQL convierte automáticamente asumiendo UTC o la timezone del servidor)

2. **Given** cualquier query que filtre por rango de fechas cruzando `users` y otras tablas
   **When** se ejecuta
   **Then** los tipos son compatibles sin cast explícito

## Tasks / Subtasks

- [ ] **Migration `052_normalize_timestamps.sql`**:
  ```sql
  ALTER TABLE users
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'UTC';
  ```

- [ ] Verificar que el BFF no tenga lógica que dependa del tipo `TIMESTAMP` de `users.created_at`

## Dev Notes

### Conversión segura
PostgreSQL convierte `TIMESTAMP → TIMESTAMPTZ` usando `AT TIME ZONE 'UTC'` o la timezone configurada en el servidor. En la mayoría de setups de producción el servidor corre en UTC, por lo que la conversión es trivial (no cambia el valor).

Verificar con:
```sql
SHOW timezone;  -- debería ser UTC o Etc/UTC
```

### Sin impacto en el BFF
Node.js + `pg` devuelve fechas como objetos `Date` independientemente de si el campo es `TIMESTAMP` o `TIMESTAMPTZ`. El cambio es transparente para el código.

### Referencias
- [Source: jedami-bff/src/database/migrations/001_init.sql]

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
