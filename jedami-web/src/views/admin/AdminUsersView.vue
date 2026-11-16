<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { apiErrorDetail } from '@/lib/auth-errors'
import { fetchAdminUsers, assignRole, removeRoleFromUser, type AdminUser } from '@/api/admin.users.api'
import { ROLE_LABELS } from '@/lib/constants'
import apiClient from '@/api/client'

interface Role { id: number; name: string }

const users = ref<AdminUser[]>([])
const roles = ref<Role[]>([])
const loading = ref(true)
const error = ref('')
const assigning = ref<number | null>(null)
const successMsg = ref<Record<number, string>>({})
const selectedRole = ref<Record<number, string>>({})

// Paginación
const page = ref(1)
const limit = 20
const total = ref(0)
const pages = computed(() => Math.ceil(total.value / limit))

// Filtros
const filterSearch = ref('')
const filterRole = ref('')

async function loadUsers() {
  loading.value = true
  error.value = ''
  try {
    const [usersData, rolesRes] = await Promise.all([
      fetchAdminUsers({ page: page.value, limit, search: filterSearch.value || undefined, role: filterRole.value || undefined }),
      roles.value.length ? Promise.resolve(null) : apiClient.get<{ data: Role[] }>('/roles'),
    ])
    users.value = usersData.users
    total.value = usersData.pagination.total
    if (rolesRes) roles.value = rolesRes.data.data

    const init: Record<number, string> = {}
    for (const u of usersData.users) init[u.id] = ''
    selectedRole.value = init
  } catch {
    error.value = 'Error al cargar usuarios.'
  } finally {
    loading.value = false
  }
}

async function applyFilters() {
  page.value = 1
  await loadUsers()
}

async function goToPage(p: number) {
  page.value = p
  await loadUsers()
}

onMounted(loadUsers)

async function handleAssignRole(userId: number) {
  const roleId = Number(selectedRole.value[userId])
  if (!roleId) return

  assigning.value = userId
  const msgs = { ...successMsg.value }
  delete msgs[userId]
  successMsg.value = msgs

  try {
    await assignRole(userId, roleId)
    await loadUsers()
    successMsg.value = { ...successMsg.value, [userId]: 'Rol asignado' }
    setTimeout(() => {
      const m = { ...successMsg.value }
      delete m[userId]
      successMsg.value = m
    }, 2500)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    error.value = e.response?.data?.detail ?? 'Error al asignar rol'
  } finally {
    assigning.value = null
  }
}

const roleColors: Record<string, string> = {
  admin:     'bg-purple-50 text-purple-700 border-purple-200',
  wholesale: 'bg-blue-50 text-blue-700 border-blue-200',
  retail:    'bg-pink-50 text-pink-700 border-pink-200',
}

const confirmingAdminAssign = ref<number | null>(null)
const removeError = ref<Record<number, string>>({})

function getRoleIdByName(name: string): number | null {
  return roles.value.find(r => r.name === name)?.id ?? null
}

async function handleAssignRoleWithConfirm(userId: number) {
  const roleId = Number(selectedRole.value[userId])
  if (!roleId) return
  const roleName = roles.value.find(r => r.id === roleId)?.name
  if (roleName === 'admin' && confirmingAdminAssign.value !== userId) {
    confirmingAdminAssign.value = userId
    return
  }
  confirmingAdminAssign.value = null
  await handleAssignRole(userId)
}

// Pasar un cliente de minorista a mayorista (o al revés): asigna el rol nuevo y quita el otro.
// El cliente ve el cambio cuando su sesión se renueva (al volver a entrar o en menos de un día).
const changingType = ref<number | null>(null)
async function changeCustomerType(user: AdminUser, to: 'wholesale' | 'retail') {
  const from = to === 'wholesale' ? 'retail' : 'wholesale'
  const toId = getRoleIdByName(to)
  const fromId = getRoleIdByName(from)
  if (!toId) return
  changingType.value = user.id
  removeError.value[user.id] = ''
  try {
    await assignRole(user.id, toId)
    if (fromId && user.roles.includes(from)) await removeRoleFromUser(user.id, fromId)
    await loadUsers()
    successMsg.value = { ...successMsg.value, [user.id]: to === 'wholesale' ? 'Ahora es mayorista' : 'Ahora es minorista' }
    setTimeout(() => {
      const m = { ...successMsg.value }
      delete m[user.id]
      successMsg.value = m
    }, 3500)
  } catch (e: unknown) {
    removeError.value[user.id] = apiErrorDetail(e, 'No se pudo cambiar el tipo de cuenta')
  } finally {
    changingType.value = null
  }
}

async function doRemoveRole(userId: number, roleName: string) {
  const roleId = getRoleIdByName(roleName)
  if (!roleId) return
  removeError.value[userId] = ''
  try {
    const updated = await removeRoleFromUser(userId, roleId)
    const idx = users.value.findIndex(u => u.id === userId)
    if (idx !== -1) {
      users.value[idx] = { ...users.value[idx]!, roles: updated.roles ?? [] }
    }
  } catch (e: unknown) {
    removeError.value[userId] = apiErrorDetail(e, 'Error al remover rol')
  }
}
</script>

<template>
  <AdminLayout>
    <div class="max-w-3xl">
      <div class="flex items-center gap-3 mb-6">
        <h1 class="text-[26px] font-bold">Clientes</h1>
      </div>

      <!-- Filtros -->
      <div class="bg-white rounded-xl border border-[var(--a-border)] p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-[160px]">
          <label class="block text-xs text-[var(--a-muted)] mb-1">Buscar por email</label>
          <input
            v-model="filterSearch"
            type="text"
            placeholder="email@..."
            class="w-full h-10 rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--a-primary)]"
            @keydown.enter="applyFilters"
          />
        </div>
        <div>
          <label class="block text-xs text-[var(--a-muted)] mb-1">Tipo</label>
          <select
            v-model="filterRole"
            class="h-10 rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--a-primary)]"
          >
            <option value="">Todos</option>
            <option v-for="role in roles" :key="role.id" :value="role.name">{{ ROLE_LABELS[role.name] ?? role.name }}</option>
          </select>
        </div>
        <button
          @click="applyFilters"
          class="h-10 px-4 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Buscar
        </button>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="animate-pulse bg-white rounded-xl border border-[var(--a-border)] h-16"></div>
      </div>

      <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <template v-else>
        <div class="space-y-3 mb-4">
          <div
            v-for="user in users"
            :key="user.id"
            class="bg-white rounded-xl border border-[var(--a-border)] p-4"
          >
            <div class="flex flex-col sm:flex-row sm:items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-[var(--a-ink)] truncate">{{ user.email }}</p>
                <div class="flex flex-wrap gap-1.5 mt-1">
                  <span
                    v-for="role in user.roles"
                    :key="role"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border"
                    :class="roleColors[role] ?? 'bg-[var(--a-bg)] text-[var(--a-muted)] border-[var(--a-border)]'"
                  >
                    {{ ROLE_LABELS[role] ?? role }}
                    <button
                      @click="doRemoveRole(user.id, role)"
                      class="opacity-60 hover:opacity-100 hover:text-red-500 transition-colors leading-none"
                      :title="`Quitar rol ${role}`"
                    >×</button>
                  </span>
                  <span v-if="user.roles.length === 0" class="text-xs text-[var(--a-muted)] italic">sin roles</span>
                </div>
                <p v-if="removeError[user.id]" class="text-xs text-red-500 mt-1">{{ removeError[user.id] }}</p>
              </div>

              <div class="flex flex-col gap-1.5 shrink-0 sm:items-end">
                <div class="flex items-center gap-2">
                  <span v-if="successMsg[user.id]" class="text-xs text-green-600 font-semibold">✓ {{ successMsg[user.id] }}</span>
                  <button
                    v-if="user.roles.includes('retail') && !user.roles.includes('wholesale')"
                    type="button"
                    :disabled="changingType === user.id"
                    class="h-8 px-3 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                    @click="changeCustomerType(user, 'wholesale')"
                  >{{ changingType === user.id ? 'Cambiando…' : 'Pasar a mayorista' }}</button>
                  <button
                    v-else-if="user.roles.includes('wholesale')"
                    type="button"
                    :disabled="changingType === user.id"
                    class="h-8 px-3 rounded-lg border border-[#C9CDD2] text-sm text-[var(--a-muted)] hover:text-[var(--a-ink)] disabled:opacity-40"
                    @click="changeCustomerType(user, 'retail')"
                  >{{ changingType === user.id ? 'Cambiando…' : 'Pasar a minorista' }}</button>
                </div>
                <details class="text-xs text-[var(--a-muted)]">
                  <summary class="cursor-pointer select-none sm:text-right">Otros roles</summary>
                <div class="flex items-center gap-2 mt-1.5">
                  <select
                    v-model="selectedRole[user.id]"
                    class="h-8 rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--a-primary)]"
                    :disabled="assigning === user.id"
                    @change="confirmingAdminAssign = null"
                  >
                    <option value="">Asignar rol…</option>
                    <option v-for="role in roles" :key="role.id" :value="role.id">{{ ROLE_LABELS[role.name] ?? role.name }}</option>
                  </select>
                  <button
                    :disabled="assigning === user.id || !selectedRole[user.id]"
                    @click="handleAssignRoleWithConfirm(user.id)"
                    class="h-8 px-3 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <span v-if="assigning === user.id" class="inline-flex items-center gap-1">
                      <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    </span>
                    <span v-else>Asignar</span>
                  </button>
                </div>
                <!-- Confirmación inline para asignar rol admin -->
                <template v-if="confirmingAdminAssign === user.id">
                  <p class="text-xs text-orange-600">¿Asignar rol administrador a {{ user.email }}? Esto da acceso total al panel.</p>
                  <div class="flex gap-2">
                    <button @click="handleAssignRole(user.id)" class="text-xs text-orange-600 font-semibold hover:underline">Confirmar</button>
                    <button @click="confirmingAdminAssign = null" class="text-xs text-[var(--a-muted)] hover:underline">Cancelar</button>
                  </div>
                </template>
                </details>
              </div>
            </div>
          </div>
          <p v-if="users.length === 0" class="text-center text-[var(--a-muted)] text-sm py-8">No hay usuarios para mostrar.</p>
        </div>

        <!-- Paginación -->
        <div class="flex items-center justify-between gap-3 text-sm text-[var(--a-muted)]">
          <span>{{ total }} cuentas · Página {{ page }} de {{ pages || 1 }}</span>
          <div class="flex gap-2 shrink-0">
            <button
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
              class="h-8 px-3 rounded-lg border border-[#C9CDD2] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >←<span class="hidden sm:inline"> Anterior</span></button>
            <button
              :disabled="page >= pages"
              @click="goToPage(page + 1)"
              class="h-8 px-3 rounded-lg border border-[#C9CDD2] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            ><span class="hidden sm:inline">Siguiente </span>→</button>
          </div>
        </div>
      </template>
    </div>
  </AdminLayout>
</template>
