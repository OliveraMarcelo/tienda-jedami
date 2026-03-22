<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'vue-router'
import {
  fetchAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  reorderAnnouncements,
  deleteAnnouncement,
  type Announcement,
} from '@/api/announcements.api'

const authStore = useAuthStore()
const router = useRouter()

if (!authStore.isAdmin) router.push('/catalogo')

const items = ref<Announcement[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const deleteConfirmId = ref<number | null>(null)

// ─── Formulario de creación ───────────────────────────────────────────────────
const showForm = ref(false)
const form = ref({
  title: '',
  body: '',
  linkUrl: '',
  linkLabel: '',
  targetAudience: 'all' as 'all' | 'authenticated' | 'wholesale' | 'retail',
  validFrom: '',
  validUntil: '',
  file: null as File | null,
})
const formError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref<string | null>(null)

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  form.value.file = file
  previewUrl.value = file ? URL.createObjectURL(file) : null
}

function resetForm() {
  form.value = { title: '', body: '', linkUrl: '', linkLabel: '', targetAudience: 'all', validFrom: '', validUntil: '', file: null }
  formError.value = ''
  previewUrl.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function submitCreate() {
  if (!form.value.title.trim()) { formError.value = 'El título es obligatorio'; return }
  saving.value = true
  formError.value = ''
  try {
    const created = await createAnnouncement({
      title: form.value.title.trim(),
      body: form.value.body || undefined,
      file: form.value.file ?? undefined,
      linkUrl: form.value.linkUrl || undefined,
      linkLabel: form.value.linkLabel || undefined,
      targetAudience: form.value.targetAudience,
      validFrom: form.value.validFrom || undefined,
      validUntil: form.value.validUntil || undefined,
    })
    items.value.push(created)
    showForm.value = false
    resetForm()
  } catch {
    formError.value = 'Error al crear el anuncio'
  } finally {
    saving.value = false
  }
}

// ─── Carga inicial ────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    items.value = await fetchAllAnnouncements()
  } catch {
    error.value = 'Error al cargar los anuncios'
  } finally {
    loading.value = false
  }
})

// ─── Toggle activo ────────────────────────────────────────────────────────────
async function toggleActive(a: Announcement) {
  try {
    const updated = await updateAnnouncement(a.id, { active: !a.active })
    const idx = items.value.findIndex(x => x.id === a.id)
    if (idx !== -1) items.value[idx] = updated
  } catch {
    error.value = 'Error al actualizar'
  }
}

// ─── Reordenar ────────────────────────────────────────────────────────────────
async function moveUp(index: number) {
  if (index === 0) return
  const arr = [...items.value]
  ;[arr[index - 1], arr[index]] = [arr[index]!, arr[index - 1]!]
  items.value = arr
  await saveOrder()
}

async function moveDown(index: number) {
  if (index === items.value.length - 1) return
  const arr = [...items.value]
  ;[arr[index], arr[index + 1]] = [arr[index + 1]!, arr[index]!]
  items.value = arr
  await saveOrder()
}

async function saveOrder() {
  try {
    await reorderAnnouncements(items.value.map((a, i) => ({ id: a.id, sortOrder: i + 1 })))
  } catch {
    error.value = 'Error al reordenar'
  }
}

// ─── Eliminar ─────────────────────────────────────────────────────────────────
async function confirmDelete(id: number) {
  try {
    await deleteAnnouncement(id)
    items.value = items.value.filter(a => a.id !== id)
  } catch {
    error.value = 'Error al eliminar'
  } finally {
    deleteConfirmId.value = null
  }
}

// ─── Badge audiencia ──────────────────────────────────────────────────────────
const audienceLabels: Record<string, string> = {
  all: 'Todos',
  authenticated: 'Autenticados',
  wholesale: 'Mayoristas',
  retail: 'Minoristas',
}

const audienceBadgeClass: Record<string, string> = {
  all:           'bg-gray-100 text-gray-700',
  authenticated: 'bg-blue-100 text-blue-700',
  wholesale:     'bg-indigo-100 text-indigo-700',
  retail:        'bg-pink-100 text-pink-700',
}
</script>

<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Anuncios</h1>
      <button
        @click="showForm = !showForm"
        class="px-4 py-2 rounded-xl bg-[var(--color-primary,#E91E8C)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        {{ showForm ? 'Cancelar' : '+ Nuevo anuncio' }}
      </button>
    </div>

    <!-- Formulario de creación -->
    <div v-if="showForm" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 space-y-4">
      <h2 class="font-semibold text-gray-800">Nuevo anuncio</h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Título -->
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-gray-600 mb-1">Título *</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="Título del anuncio"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#E91E8C)]"
          />
        </div>

        <!-- Body -->
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-gray-600 mb-1">Texto</label>
          <textarea
            v-model="form.body"
            rows="3"
            placeholder="Descripción o detalle del anuncio..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#E91E8C)] resize-none"
          />
        </div>

        <!-- Imagen -->
        <div class="sm:col-span-2">
          <label class="block text-xs font-semibold text-gray-600 mb-1">Imagen (opcional)</label>
          <input ref="fileInput" type="file" accept="image/*" @change="onFileChange" class="text-sm text-gray-600" />
          <img v-if="previewUrl" :src="previewUrl" alt="Preview" class="mt-2 h-24 w-auto rounded-lg object-cover border border-gray-200" />
        </div>

        <!-- Link URL -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">URL destino (opcional)</label>
          <input
            v-model="form.linkUrl"
            type="text"
            placeholder="/catalogo o https://..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#E91E8C)]"
          />
        </div>

        <!-- Link label -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Texto del botón CTA</label>
          <input
            v-model="form.linkLabel"
            type="text"
            placeholder="Ver más"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#E91E8C)]"
          />
        </div>

        <!-- Target audience -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Audiencia</label>
          <select
            v-model="form.targetAudience"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#E91E8C)]"
          >
            <option value="all">Todos (visitantes + autenticados)</option>
            <option value="authenticated">Solo autenticados</option>
            <option value="wholesale">Solo mayoristas</option>
            <option value="retail">Solo minoristas</option>
          </select>
        </div>

        <!-- Vigencia desde -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Vigente desde (opcional)</label>
          <input
            v-model="form.validFrom"
            type="datetime-local"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#E91E8C)]"
          />
        </div>

        <!-- Vigencia hasta -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Vigente hasta (opcional)</label>
          <input
            v-model="form.validUntil"
            type="datetime-local"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#E91E8C)]"
          />
        </div>
      </div>

      <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>

      <button
        @click="submitCreate"
        :disabled="saving"
        class="px-5 py-2 rounded-xl bg-[var(--color-primary,#E91E8C)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {{ saving ? 'Guardando…' : 'Crear anuncio' }}
      </button>
    </div>

    <!-- Error global -->
    <p v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{{ error }}</p>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="n in 3" :key="n" class="h-20 rounded-2xl bg-gray-200 animate-pulse" />
    </div>

    <!-- Lista de anuncios -->
    <div v-else-if="items.length > 0" class="space-y-3">
      <div
        v-for="(a, index) in items"
        :key="a.id"
        class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-start gap-4"
        :class="{ 'opacity-50': !a.active }"
      >
        <!-- Thumbnail -->
        <img
          v-if="a.imageUrl"
          :src="a.imageUrl"
          :alt="a.title"
          class="w-16 h-16 rounded-xl object-cover flex-none border border-gray-100"
        />
        <div v-else class="w-16 h-16 rounded-xl bg-gray-100 flex-none flex items-center justify-center text-2xl text-gray-300">📢</div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <p class="font-semibold text-gray-900 text-sm">{{ a.title }}</p>
            <span
              class="text-xs px-2 py-0.5 rounded-full font-medium"
              :class="audienceBadgeClass[a.targetAudience]"
            >{{ audienceLabels[a.targetAudience] }}</span>
            <span
              class="text-xs px-2 py-0.5 rounded-full font-medium"
              :class="a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
            >{{ a.active ? 'Activo' : 'Inactivo' }}</span>
          </div>
          <p v-if="a.body" class="text-xs text-gray-500 truncate">{{ a.body }}</p>
          <p v-if="a.validFrom || a.validUntil" class="text-xs text-gray-400 mt-1">
            <span v-if="a.validFrom">Desde {{ new Date(a.validFrom).toLocaleDateString('es-AR') }}</span>
            <span v-if="a.validFrom && a.validUntil"> · </span>
            <span v-if="a.validUntil">Hasta {{ new Date(a.validUntil).toLocaleDateString('es-AR') }}</span>
          </p>
        </div>

        <!-- Acciones -->
        <div class="flex flex-col gap-1.5 flex-none">
          <button
            @click="toggleActive(a)"
            class="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors"
            :class="a.active
              ? 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600'
              : 'border-green-300 text-green-700 hover:bg-green-50'"
          >{{ a.active ? 'Desactivar' : 'Activar' }}</button>

          <div class="flex gap-1">
            <button
              @click="moveUp(index)"
              :disabled="index === 0"
              class="px-2 py-1 rounded-lg text-xs border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none"
              title="Subir"
            >↑</button>
            <button
              @click="moveDown(index)"
              :disabled="index === items.length - 1"
              class="px-2 py-1 rounded-lg text-xs border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none"
              title="Bajar"
            >↓</button>
          </div>

          <template v-if="deleteConfirmId === a.id">
            <button
              @click="confirmDelete(a.id)"
              class="px-3 py-1 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
            >Confirmar</button>
            <button
              @click="deleteConfirmId = null"
              class="px-3 py-1 rounded-lg text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >Cancelar</button>
          </template>
          <button
            v-else
            @click="deleteConfirmId = a.id"
            class="px-3 py-1 rounded-lg text-xs border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >Eliminar</button>
        </div>
      </div>
    </div>

    <!-- Sin anuncios -->
    <div v-else class="text-center py-16 text-gray-500">
      <p class="text-4xl mb-4">📢</p>
      <p class="font-medium">Todavía no hay anuncios.</p>
      <p class="text-sm mt-1">Creá el primero con el botón de arriba.</p>
    </div>
  </AppLayout>
</template>
