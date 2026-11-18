<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import DateRangeFilter from '@/components/features/admin/DateRangeFilter.vue'
import SearchField from '@/components/features/admin/SearchField.vue'
import TablePagination from '@/components/features/admin/TablePagination.vue'
import SidePanel from '@/components/features/admin/SidePanel.vue'
import { apiErrorDetail } from '@/lib/auth-errors'
import { fetchAdminUsers, assignRole, removeRoleFromUser, type AdminUser } from '@/api/admin.users.api'
import { ROLE_LABELS } from '@/lib/constants'
import { PAGE_SIZE, EMPTY_RANGE, rangeToIso, debounce, type DateRange } from '@/lib/date-range'
import apiClient from '@/api/client'

interface Role { id: number; name: string }

const users = ref<AdminUser[]>([])
const roles = ref<Role[]>([])
const loading = ref(true)
const loaded = ref(false)
const error = ref('')
const assigning = ref<number | null>(null)
const successMsg = ref<Record<number, string>>({})
const selectedRole = ref<Record<number, string>>({})

// Paginación
const page = ref(1)
const total = ref(0)

// Filtros: se aplican solos al cambiar
const filterSearch = ref('')
const filterRole = ref('')
const filterRange = ref<DateRange>({ ...EMPTY_RANGE })

let requestId = 0

async function loadUsers() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const [usersData, rolesRes] = await Promise.all([
      fetchAdminUsers({
        page: page.value,
        limit: PAGE_SIZE,
        search: filterSearch.value.trim() || undefined,
        role: filterRole.value || undefined,
        ...rangeToIso(filterRange.value),
      }),
      roles.value.length ? Promise.resolve(null) : apiClient.get<{ data: Role[] }>('/roles'),
    ])
    if (rolesRes) roles.value = rolesRes.data.data
    if (id !== requestId) return
    users.value = usersData.users
    total.value = usersData.pagination.total

    const init: Record<number, string> = {}
    for (const u of usersData.users) init[u.id] = ''
    selectedRole.value = init
  } catch {
    if (id === requestId) error.value = 'Error al cargar los clientes.'
  } finally {
    if (id === requestId) {
      loading.value = false
      loaded.value = true
    }
  }
}

function reload() {
  page.value = 1
  loadUsers()
}

watch([filterRole, filterRange], reload)
watch(filterSearch, debounce(reload, 350))
watch(page, loadUsers)

onMounted(loadUsers)

const hasFilters = () => !!(filterSearch.value || filterRole.value || filterRange.value.from || filterRange.value.to)
function clearFilters() {
  filterSearch.value = ''
  filterRole.value = ''
  filterRange.value = { ...EMPTY_RANGE }
}

// Panel con el detalle y los roles de una cuenta
const selectedId = ref<number | null>(null)
const selectedUser = computed(() => users.value.find(u => u.id === selectedId.value) ?? null)
const panelOpen = computed({
  get: () => selectedUser.value !== null,
  set: (v) => { if (!v) { selectedId.value = null; confirmingAdminAssign.value = null } },
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

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
  <AdminLayout title="Clientes">
    <div class="rounded-xl border border-[var(--a-border)] bg-white">
      <!-- Filtros en una sola franja: se aplican al cambiar -->
      <div class="grid grid-cols-1 gap-2 border-b border-[var(--a-border)] p-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_minmax(170px,1fr)_minmax(220px,1fr)_auto]">
        <SearchField v-model="filterSearch" compact label="Buscar por email" placeholder="Buscar por email" />
        <select v-model="filterRole" aria-label="Tipo de cuenta" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none">
          <option value="">Todos los tipos</option>
          <option v-for="role in roles" :key="role.id" :value="role.name">{{ ROLE_LABELS[role.name] ?? role.name }}</option>
        </select>
        <DateRangeFilter v-model="filterRange" compact label="Fecha de alta" />
        <button
          v-if="hasFilters()"
          type="button"
          class="h-10 rounded-lg px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-bg)] hover:text-[var(--a-ink)]"
          @click="clearFilters"
        >Limpiar</button>
      </div>

      <div v-if="!loaded" class="space-y-2 p-3">
        <div v-for="i in 8" :key="i" class="h-10 animate-pulse rounded-lg bg-[var(--a-bg)]"></div>
      </div>

      <p v-else-if="error" class="p-4 text-sm text-red-500">{{ error }}</p>

      <div v-else :class="['transition-opacity duration-200', loading ? 'opacity-50' : 'opacity-100']">
        <p v-if="users.length === 0" class="px-4 py-10 text-center text-sm text-[var(--a-muted)]">No hay clientes con estos filtros.</p>

        <div v-else class="overflow-x-auto overflow-y-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--a-border)] text-left">
                <th class="px-4 py-2.5">Cliente</th>
                <th class="px-4 py-2.5">Tipo</th>
                <th class="hidden px-4 py-2.5 sm:table-cell">Alta</th>
                <th class="px-4 py-2.5 text-right"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody :key="page" class="jd-stagger">
              <tr
                v-for="user in users"
                :key="user.id"
                :class="['h-12 cursor-pointer border-b border-[var(--a-border)] last:border-0 hover:bg-[var(--a-bg)]', selectedId === user.id ? 'bg-[var(--a-primary-soft)]' : '']"
                @click="selectedId = user.id"
              >
                <td class="max-w-[320px] px-4">
                  <span class="block truncate font-medium" :title="user.email">{{ user.email }}</span>
                </td>
                <td class="whitespace-nowrap px-4">
                  <span
                    v-for="role in user.roles"
                    :key="role"
                    class="mr-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
                    :class="roleColors[role] ?? 'bg-[var(--a-bg)] text-[var(--a-muted)] border-[var(--a-border)]'"
                  >{{ ROLE_LABELS[role] ?? role }}</span>
                  <span v-if="user.roles.length === 0" class="text-xs italic text-[var(--a-muted)]">sin roles</span>
                </td>
                <td class="hidden whitespace-nowrap px-4 text-[var(--a-muted)] sm:table-cell">{{ formatDate(user.createdAt) }}</td>
                <td class="whitespace-nowrap px-4 text-right" @click.stop>
                  <Transition name="jd-fade">
                    <span v-if="successMsg[user.id]" class="mr-2 text-xs font-semibold text-green-600">✓ {{ successMsg[user.id] }}</span>
                  </Transition>
                  <button
                    v-if="user.roles.includes('retail') && !user.roles.includes('wholesale')"
                    type="button"
                    :disabled="changingType === user.id"
                    class="h-8 rounded-lg border border-[#C9CDD2] px-3 text-xs font-semibold text-[var(--a-primary)] disabled:opacity-40"
                    @click="changeCustomerType(user, 'wholesale')"
                  >{{ changingType === user.id ? 'Cambiando…' : 'Pasar a mayorista' }}</button>
                  <button
                    v-else-if="user.roles.includes('wholesale')"
                    type="button"
                    :disabled="changingType === user.id"
                    class="h-8 rounded-lg border border-[#C9CDD2] px-3 text-xs font-semibold text-[var(--a-muted)] hover:text-[var(--a-ink)] disabled:opacity-40"
                    @click="changeCustomerType(user, 'retail')"
                  >{{ changingType === user.id ? 'Cambiando…' : 'Pasar a minorista' }}</button>
                  <button
                    type="button"
                    class="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg align-middle text-[var(--a-muted)] hover:bg-white hover:text-[var(--a-ink)]"
                    :aria-label="`Ver ${user.email}`"
                    @click="selectedId = user.id"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                  <p v-if="removeError[user.id]" class="mt-1 text-xs font-normal text-red-500">{{ removeError[user.id] }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <TablePagination v-model:page="page" :total="total" noun="cuentas" />
      </div>
    </div>

    <!-- Detalle y roles de la cuenta -->
    <SidePanel v-model:open="panelOpen" :title="selectedUser?.email ?? ''" :subtitle="selectedUser ? `Alta ${formatDate(selectedUser.createdAt)}` : ''">
      <div v-if="selectedUser" class="space-y-6 text-sm">
        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--a-muted)]">Tipo de cuenta</h3>
          <p class="mb-3 text-[var(--a-muted)]">Define qué precios ve. El cambio le llega cuando vuelve a entrar.</p>
          <div class="flex items-center gap-2">
            <button
              v-if="selectedUser.roles.includes('retail') && !selectedUser.roles.includes('wholesale')"
              type="button"
              :disabled="changingType === selectedUser.id"
              class="h-10 rounded-lg bg-[var(--a-primary)] px-4 font-semibold text-white disabled:opacity-40"
              @click="changeCustomerType(selectedUser, 'wholesale')"
            >{{ changingType === selectedUser.id ? 'Cambiando…' : 'Pasar a mayorista' }}</button>
            <button
              v-else-if="selectedUser.roles.includes('wholesale')"
              type="button"
              :disabled="changingType === selectedUser.id"
              class="h-10 rounded-lg border border-[#C9CDD2] px-4 font-semibold disabled:opacity-40"
              @click="changeCustomerType(selectedUser, 'retail')"
            >{{ changingType === selectedUser.id ? 'Cambiando…' : 'Pasar a minorista' }}</button>
            <span v-else class="text-[var(--a-muted)]">No es cliente minorista ni mayorista.</span>
            <span v-if="successMsg[selectedUser.id]" class="text-xs font-semibold text-green-600">✓ {{ successMsg[selectedUser.id] }}</span>
          </div>
        </section>

        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--a-muted)]">Roles</h3>
          <ul class="divide-y divide-[var(--a-border)] rounded-lg border border-[var(--a-border)]">
            <li v-for="role in selectedUser.roles" :key="role" class="flex items-center justify-between px-3 py-2">
              <span
                class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
                :class="roleColors[role] ?? 'bg-[var(--a-bg)] text-[var(--a-muted)] border-[var(--a-border)]'"
              >{{ ROLE_LABELS[role] ?? role }}</span>
              <button type="button" class="text-xs font-semibold text-red-500 hover:text-red-700" @click="doRemoveRole(selectedUser.id, role)">Quitar</button>
            </li>
            <li v-if="selectedUser.roles.length === 0" class="px-3 py-2 italic text-[var(--a-muted)]">Sin roles</li>
          </ul>
          <p v-if="removeError[selectedUser.id]" class="mt-1 text-xs text-red-500">{{ removeError[selectedUser.id] }}</p>

          <div class="mt-3 flex items-center gap-2">
            <select
              v-model="selectedRole[selectedUser.id]"
              aria-label="Rol para asignar"
              class="h-10 flex-1 rounded-lg border border-[#C9CDD2] px-2 text-sm focus:outline-none"
              :disabled="assigning === selectedUser.id"
              @change="confirmingAdminAssign = null"
            >
              <option value="">Asignar otro rol…</option>
              <option v-for="role in roles" :key="role.id" :value="role.id">{{ ROLE_LABELS[role.name] ?? role.name }}</option>
            </select>
            <button
              type="button"
              :disabled="assigning === selectedUser.id || !selectedRole[selectedUser.id]"
              class="h-10 rounded-lg bg-[var(--a-primary)] px-4 font-semibold text-white disabled:pointer-events-none disabled:opacity-40"
              @click="handleAssignRoleWithConfirm(selectedUser.id)"
            >{{ assigning === selectedUser.id ? '…' : 'Asignar' }}</button>
          </div>
          <div v-if="confirmingAdminAssign === selectedUser.id" class="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p class="text-orange-700">¿Hacer administrador a {{ selectedUser.email }}? Va a tener acceso total al panel.</p>
            <div class="mt-2 flex gap-3">
              <button type="button" class="font-semibold text-orange-700 hover:underline" @click="handleAssignRole(selectedUser.id)">Confirmar</button>
              <button type="button" class="text-[var(--a-muted)] hover:underline" @click="confirmingAdminAssign = null">Cancelar</button>
            </div>
          </div>
        </section>
      </div>
    </SidePanel>
  </AdminLayout>
</template>
