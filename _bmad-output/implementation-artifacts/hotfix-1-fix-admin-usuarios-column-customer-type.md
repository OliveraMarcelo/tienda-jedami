# Story hotfix.1: Fix — columna customer_type en query de admin/usuarios

Status: done

## Story

Como administrador de Jedami,
quiero que la vista `/admin/usuarios` cargue la lista de usuarios correctamente,
para poder gestionar los usuarios del sistema sin errores.

## Acceptance Criteria

1. **AC1 — Sin error 500:** `GET /api/v1/admin/users?page=1&limit=20` responde con HTTP 200 y devuelve la lista paginada de usuarios.
2. **AC2 — Campo customer_type correcto:** La respuesta incluye el campo `customer_type` con los valores `retail` o `wholesale` (o `null` si el usuario no tiene perfil de customer).
3. **AC3 — Vista UI funcional:** La página `/admin/usuarios` en jedami-web muestra la tabla de usuarios sin el mensaje "Error al cargar usuarios."

## Tasks / Subtasks

- [x] **Task 1 — Corregir la query SQL** (AC: #1, #2)
  - [x] 1.1 Abrir `jedami-bff/src/modules/admin/queries/users.ts`
  - [x] 1.2 Línea 9: cambiar `c.type     AS customer_type` → `c.customer_type`
  - [x] 1.3 Línea 16: cambiar `GROUP BY u.id, u.email, u.created_at, c.id, c.type` → `GROUP BY u.id, u.email, u.created_at, c.id, c.customer_type`
  - [x] 1.4 Verificar que el alias devuelto sigue siendo `customer_type` (ya lo era implícitamente, no hace falta alias explícito — el nombre del campo es igual al de la columna)

- [x] **Task 2 — Verificación local** (AC: #1, #2, #3)
  - [x] 2.1 Confirmar que la API responde 200 en `GET /api/v1/admin/users?page=1&limit=20` (verificado via integration test)
  - [x] 2.2 Confirmar que la vista `/admin/usuarios` muestra la tabla de usuarios — API verificada via tests; UI verificable tras deploy

## Dev Notes

### Causa raíz

La migración `006_customers_orders.sql` define la tabla así:

```sql
CREATE TABLE customers (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  customer_type VARCHAR(20) NOT NULL DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale'))
);
```

La columna se llama `customer_type`, **no** `type`. La query en `ADMIN_USERS_QUERY` referenciaba incorrectamente `c.type` causando el error de PostgreSQL:
```
column c.type does not exist
```

### Archivo a modificar

**`jedami-bff/src/modules/admin/queries/users.ts`**

```diff
- c.type     AS customer_type
+ c.customer_type
```

```diff
- GROUP BY u.id, u.email, u.created_at, c.id, c.type
+ GROUP BY u.id, u.email, u.created_at, c.id, c.customer_type
```

### Convenciones del proyecto

- Base de datos: SQL puro con `pg` Pool — sin ORM
- Queries en `modules/<nombre>/queries/*.ts`
- **NUNCA ejecutar `npm run build`** — el usuario lo prueba por su cuenta

### Project Structure Notes

- Archivo afectado: `jedami-bff/src/modules/admin/queries/users.ts` (líneas 9 y 16)
- Migración de referencia: `jedami-bff/src/database/migrations/006_customers_orders.sql`
- No se toca ningún otro archivo

### References

- [Source: jedami-bff/src/modules/admin/queries/users.ts#L9,L16]
- [Source: jedami-bff/src/database/migrations/006_customers_orders.sql#L6] — definición de la columna `customer_type`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Corregidas 2 referencias a `c.type` → `c.customer_type AS customer_type` en `ADMIN_USERS_QUERY` (líneas 9 y 16).
- La columna en la tabla `customers` (migración 006) se llama `customer_type`, no `type`.
- El mapeo `r.customer_type → customerType` en el controller ya era correcto; solo fallaba la query SQL.
- Alias explícito `AS customer_type` agregado para consistencia con `c.id AS customer_id`.
- [Code Review] Expandidos tests de integración a 5 casos: HTTP 200 + paginación completa, customerType null, customerType 'retail', customerType 'wholesale', 401 sin token.
- Suite completa: 8 fallas pre-existentes (auth, webhook) — sin regresiones nuevas introducidas.

### File List

- `jedami-bff/src/modules/admin/queries/users.ts` (modificado)
- `jedami-bff/src/__tests__/admin-users.test.ts` (nuevo)
