# Story 9.8: Remoción de Roles de Usuario — BFF

Status: done

## Story

Como administrador,
quiero poder quitar un rol a un usuario desde el panel web,
para corregir asignaciones incorrectas sin necesidad de acceso directo a la base de datos.

## Acceptance Criteria

1. **Given** un usuario tiene el rol `admin` o cualquier otro rol
   **When** el admin llama `DELETE /admin/users/:id/roles/:roleId`
   **Then** el rol se elimina de `user_roles` para ese usuario
   **And** retorna 200 con el usuario actualizado (lista de roles sin el rol removido)

2. **Given** el usuario no tiene el rol especificado
   **When** se intenta remover
   **Then** retorna 404 con `{ detail: "El usuario no tiene ese rol" }`

3. **Given** el admin intenta removerse a sí mismo el rol admin
   **When** llama al endpoint con su propio `id`
   **Then** retorna 403 con `{ detail: "No podés remover tu propio rol admin" }`

4. **Given** el `roleId` no existe
   **When** se llama al endpoint
   **Then** retorna 404 con `{ detail: "Rol no encontrado" }`

## Tasks / Subtasks

- [ ] Crear handler `removeRoleFromUser` en `modules/users/users.controller.ts` (AC: 1, 2, 3, 4)
  - Validar que no sea self-demotion del rol admin (AC: 3)
  - Verificar que el rol existe en `roles` (AC: 4)
  - Verificar que el usuario tiene el rol en `user_roles` (AC: 2)
  - Ejecutar `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`
  - Retornar el usuario con la lista de roles actualizada
- [ ] Agregar `removeRole(userId, roleId)` en `users.repository.ts` (AC: 1)
- [ ] Registrar `DELETE /admin/users/:id/roles/:roleId` en `routes/admin.routes.ts` (o donde viven los endpoints de admin usuarios) con `authMiddleware + requireRole([ROLES.ADMIN])` (AC: 1)

## Dev Notes

### Dónde vive la asignación de roles
El endpoint `POST /admin/users/:id/roles` para asignar roles ya existe (usado en AdminUsersView). El DELETE va en el mismo router y controller.

### Validación self-demotion
```typescript
const targetUserId = Number(req.params.id)
const requestingUserId = req.user.id  // del JWT
const adminRoleId = await getRoleIdByCode('admin') // o buscarlo en roles table

if (requestingUserId === targetUserId && roleId === adminRoleId) {
  res.status(403).json({ detail: 'No podés remover tu propio rol admin' })
  return
}
```

### Query
```typescript
const result = await pool.query(
  'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
  [userId, roleId]
)
if ((result.rowCount ?? 0) === 0) {
  // El usuario no tenía ese rol
  throw new AppError(404, 'El usuario no tiene ese rol', ...)
}
```

### Response
Retornar el usuario con sus roles actualizados (igual que POST /admin/users/:id/roles):
```json
{
  "data": {
    "id": 5,
    "email": "user@example.com",
    "roles": ["wholesale"]
  }
}
```

### Ruta
```typescript
router.delete('/users/:id/roles/:roleId', authMiddleware, requireRole([ROLES.ADMIN]), removeRoleFromUser)
```

### Referencias
- [Source: jedami-bff/src/modules/users/users.controller.ts]
- [Source: jedami-bff/src/modules/users/users.repository.ts]
- [Source: jedami-bff/src/routes/admin.routes.ts o users.routes.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
