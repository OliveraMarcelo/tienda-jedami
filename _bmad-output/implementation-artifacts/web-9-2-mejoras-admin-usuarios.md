# Story W9.2: Mejoras en la Gestión de Usuarios Admin — Web

Status: done

## Story

Como administrador,
quiero poder quitar roles a usuarios y tener confirmación antes de asignar el rol admin,
para operar el panel de usuarios con más control y sin errores accidentales.

## Acceptance Criteria

1. **Given** el admin está en `AdminUsersView` y hace click en "Asignar admin" a un usuario
   **When** hace click en el botón
   **Then** aparece una confirmación inline `"¿Asignar rol admin a [email]? Esta acción le da acceso total al panel."` con botones Confirmar / Cancelar

2. **Given** un usuario tiene uno o más roles asignados
   **When** el admin ve la fila del usuario
   **Then** cada badge de rol muestra un ícono × para removerlo

3. **Given** el admin hace click en × de un rol
   **When** confirma la acción
   **Then** se llama `DELETE /admin/users/:id/roles/:roleId`
   **And** el badge desaparece de la fila sin recargar la página

4. **Given** el admin intenta removerse a sí mismo el rol admin
   **When** hace click en × sobre su propio rol admin
   **Then** el BFF retorna 403 y se muestra el mensaje de error

## Tasks / Subtasks

- [ ] Agregar `removeRoleFromUser(userId, roleId)` en `src/api/admin.users.api.ts` → `DELETE /admin/users/:id/roles/:roleId` (AC: 3)
- [ ] Actualizar `AdminUsersView.vue` (AC: 1, 2, 3, 4):
  - [ ] Agregar confirmación inline antes de asignar rol admin (AC: 1)
  - [ ] Mostrar badges de roles con botón × para cada uno (AC: 2)
  - [ ] Handler `removeRole(userId, roleId)`: llama la API y actualiza la lista local (AC: 3)
  - [ ] Mostrar error si el BFF retorna 403 (AC: 4)

## Dev Notes

### Función API
```typescript
// admin.users.api.ts
export async function removeRoleFromUser(userId: number, roleId: number): Promise<AdminUser> {
  const res = await apiClient.delete<{ data: AdminUser }>(`/admin/users/${userId}/roles/${roleId}`)
  return res.data.data
}
```

### Confirmación antes de asignar admin
```typescript
const confirmingAdminAssign = ref<number | null>(null)

// En el template: si el rol a asignar es ROLES.ADMIN
<template v-if="confirmingAdminAssign === user.id">
  <p class="text-xs text-orange-600">¿Asignar rol admin a {{ user.email }}?</p>
  <div class="flex gap-2">
    <button @click="doAssignAdmin(user.id)" class="text-xs text-orange-600 font-semibold">Confirmar</button>
    <button @click="confirmingAdminAssign = null" class="text-xs text-gray-500">Cancelar</button>
  </div>
</template>
<button v-else @click="confirmingAdminAssign = user.id" class="...">Asignar admin</button>
```

### Badge de rol con ×
```vue
<span
  v-for="role in user.roles"
  :key="role"
  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
>
  {{ role }}
  <button
    @click="removeRole(user.id, getRoleId(role))"
    class="text-blue-400 hover:text-red-500 transition-colors leading-none"
    :title="`Quitar rol ${role}`"
  >×</button>
</span>
```

### Handler removeRole
```typescript
const removeError = ref<Record<number, string>>({})

async function removeRole(userId: number, roleId: number) {
  removeError.value[userId] = ''
  try {
    const updated = await removeRoleFromUser(userId, roleId)
    const idx = users.value.findIndex(u => u.id === userId)
    if (idx !== -1) users.value[idx] = updated
  } catch (e: any) {
    removeError.value[userId] = e?.response?.data?.detail ?? 'Error al remover rol'
  }
}
```

### Resolver roleId desde role code
Se necesita mapear el code del rol (`'admin'`, `'wholesale'`, etc.) a su ID numérico para llamar al endpoint DELETE. Opciones:
1. El `AdminUser` retorna `roles: [{ id, code }]` (cambiar el tipo si actualmente retorna solo strings)
2. Buscar el `roleId` en `configStore.config.roles`

Verificar qué retorna actualmente `GET /admin/users` para los roles del usuario.

### Depende de
Story 9-8 (BFF remoción de roles) debe estar done.

### Referencias
- [Source: jedami-web/src/views/admin/AdminUsersView.vue]
- [Source: jedami-web/src/api/admin.users.api.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
