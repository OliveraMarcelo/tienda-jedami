<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { fetchUsers, assignRole, type UserWithRoles } from '@/api/admin.users.api'
import apiClient from '@/api/client'

const router = useRouter()

interface Role { id: number; name: string }

const users = ref<UserWithRoles[]>([])
const roles = ref<Role[]>([])
const loading = ref(true)
const error = ref('')
const assigning = ref<number | null>(null)
const successMsg = ref<Record<number, string>>({})
// Rol seleccionado por userId
const selectedRole = ref<Record<number, string>>({})

onMounted(async () => {
  try {
    const [usersData, rolesRes] = await Promise.all([
      fetchUsers(),
      apiClient.get<{ data: Role[] }>('/roles'),
    ])
    users.value = usersData
    roles.value = rolesRes.data.data
    // Inicializar clave por usuario para que Vue trackee la reactividad
    const init: Record<number, string> = {}
    for (const u of usersData) init[u.id] = ''
    selectedRole.value = init
  } catch {
    error.value = 'Error al cargar usuarios.'
  } finally {
    loading.value = false
  }
})

async function handleAssignRole(userId: number) {
  const roleId = Number(selectedRole.value[userId])
  if (!roleId) return

  assigning.value = userId
  const msgs = { ...successMsg.value }
  delete msgs[userId]
  successMsg.value = msgs

  try {
    await assignRole(userId, roleId)
    const refreshed = await fetchUsers()
    users.value = refreshed
    const init: Record<number, string> = {}
    for (const u of refreshed) init[u.id] = ''
    selectedRole.value = init
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
</script>

<template>
  <AppLayout>
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/admin')" class="text-sm text-gray-500 hover:text-[#E91E8C]">
          ← Admin
        </button>
        <h1 class="text-2xl font-bold text-gray-900">Usuarios</h1>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="animate-pulse bg-white rounded-2xl border border-gray-200 h-16"></div>
      </div>

      <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <div v-else class="space-y-3">
        <div
          v-for="user in users"
          :key="user.id"
          class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-800 truncate">{{ user.email }}</p>
              <div class="flex flex-wrap gap-1.5 mt-1">
                <span
                  v-for="role in user.roles"
                  :key="role"
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border"
                  :class="roleColors[role] ?? 'bg-gray-50 text-gray-600 border-gray-200'"
                >
                  {{ role }}
                </span>
                <span v-if="user.roles.length === 0" class="text-xs text-gray-400 italic">sin roles</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <select
                v-model="selectedRole[user.id]"
                class="h-8 rounded-lg border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
                :disabled="assigning === user.id"
              >
                <option value="">Asignar rol…</option>
                <option
                  v-for="role in roles"
                  :key="role.id"
                  :value="role.id"
                >
                  {{ role.name }}
                </option>
              </select>
              <button
                :disabled="assigning === user.id || !selectedRole[user.id]"
                @click="handleAssignRole(user.id)"
                class="h-8 px-3 rounded-lg bg-[#E91E8C] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >
                <span v-if="assigning === user.id" class="inline-flex items-center gap-1">
                  <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </span>
                <span v-else>Asignar</span>
              </button>
              <span v-if="successMsg[user.id]" class="text-xs text-green-600 font-semibold">✓ {{ successMsg[user.id] }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
