<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import {
  fetchAllBanners,
  uploadBanner,
  updateBanner,
  reorderBanners,
  deleteBanner,
  type Banner,
} from '@/api/banners.api'

const router = useRouter()

const loading = ref(true)
const error = ref('')
const banners = ref<Banner[]>([])

// ─── Upload ───────────────────────────────────────────────────────────────────
const selectedFile = ref<File | null>(null)
const linkUrlInput = ref('')
const uploading = ref(false)
const uploadError = ref('')

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { uploadError.value = 'Solo se permiten imágenes'; return }
  if (file.size > 5 * 1024 * 1024) { uploadError.value = 'La imagen no puede superar 5 MB'; return }
  uploadError.value = ''
  selectedFile.value = file
}

async function doUpload() {
  if (!selectedFile.value) { uploadError.value = 'Seleccioná una imagen'; return }
  uploading.value = true
  uploadError.value = ''
  try {
    const banner = await uploadBanner(selectedFile.value, linkUrlInput.value.trim() || undefined)
    banners.value.push({ ...banner, active: true })
    selectedFile.value = null
    linkUrlInput.value = ''
    const input = document.getElementById('banner-file-input') as HTMLInputElement | null
    if (input) input.value = ''
  } catch {
    uploadError.value = 'Error al subir el banner'
  } finally {
    uploading.value = false
  }
}

// ─── Toggle activo ────────────────────────────────────────────────────────────
const togglingId = ref<number | null>(null)

async function toggleActive(banner: Banner) {
  togglingId.value = banner.id
  try {
    const updated = await updateBanner(banner.id, { active: !banner.active })
    const idx = banners.value.findIndex(b => b.id === banner.id)
    if (idx !== -1) banners.value[idx] = { ...banners.value[idx], ...updated }
  } finally {
    togglingId.value = null
  }
}

// ─── Reordenar ────────────────────────────────────────────────────────────────
const reordering = ref(false)

async function move(index: number, dir: -1 | 1) {
  const target = index + dir
  if (target < 0 || target >= banners.value.length) return
  reordering.value = true
  const list = [...banners.value]
  ;[list[index], list[target]] = [list[target], list[index]]
  banners.value = list.map((b, i) => ({ ...b, sortOrder: i + 1 }))
  try {
    await reorderBanners(banners.value.map(b => ({ id: b.id, sortOrder: b.sortOrder })))
  } finally {
    reordering.value = false
  }
}

// ─── Eliminar ─────────────────────────────────────────────────────────────────
const confirmingDelete = ref<number | null>(null)
const deleteError = ref<Record<number, string>>({})

async function doDelete(id: number) {
  deleteError.value[id] = ''
  try {
    await deleteBanner(id)
    banners.value = banners.value.filter(b => b.id !== id)
    confirmingDelete.value = null
  } catch {
    deleteError.value[id] = 'Error al eliminar'
  }
}

// ─── Load ─────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  error.value = ''
  try {
    banners.value = await fetchAllBanners()
  } catch {
    error.value = 'Error al cargar los banners'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <AppLayout>
    <div class="max-w-3xl mx-auto">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/admin')" class="text-sm text-gray-500 hover:text-[#E91E8C]">← Admin</button>
        <h1 class="text-2xl font-bold text-gray-900">Banners del catálogo</h1>
      </div>

      <p class="text-sm text-gray-500 mb-6">
        Las imágenes activas se muestran como carrusel en la parte superior del catálogo, en el orden indicado.
      </p>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-3 mb-6">
        <div v-for="i in 3" :key="i" class="animate-pulse bg-white rounded-2xl border border-gray-200 h-20" />
      </div>

      <p v-else-if="error" class="text-red-500 text-sm mb-6">{{ error }}</p>

      <!-- Lista de banners -->
      <div v-else class="space-y-3 mb-8">
        <p v-if="banners.length === 0" class="text-sm text-gray-400 text-center py-8">
          No hay banners cargados todavía.
        </p>

        <div
          v-for="(banner, index) in banners"
          :key="banner.id"
          class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-4"
          :class="!banner.active ? 'opacity-60' : ''"
        >
          <!-- Thumbnail -->
          <img
            :src="banner.imageUrl"
            :alt="`Banner ${banner.id}`"
            class="w-20 h-14 object-cover rounded-lg flex-shrink-0 border border-gray-100"
          />

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800">Banner #{{ banner.id }}</p>
            <p v-if="banner.linkUrl" class="text-xs text-gray-500 truncate mt-0.5">
              Enlace: {{ banner.linkUrl }}
            </p>
            <p v-else class="text-xs text-gray-400 mt-0.5">Sin enlace</p>
          </div>

          <!-- Acciones -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Toggle activo -->
            <button
              :disabled="togglingId === banner.id"
              @click="toggleActive(banner)"
              class="text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors"
              :class="banner.active
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'"
            >
              {{ banner.active ? 'Activo' : 'Inactivo' }}
            </button>

            <!-- Reordenar -->
            <button
              :disabled="index === 0 || reordering"
              @click="move(index, -1)"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-[#E91E8C] hover:text-[#E91E8C] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Subir"
            >↑</button>
            <button
              :disabled="index === banners.length - 1 || reordering"
              @click="move(index, 1)"
              class="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-[#E91E8C] hover:text-[#E91E8C] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Bajar"
            >↓</button>

            <!-- Eliminar -->
            <template v-if="confirmingDelete !== banner.id">
              <button
                @click="confirmingDelete = banner.id"
                class="text-xs text-red-400 hover:text-red-600 font-medium"
              >Eliminar</button>
            </template>
            <template v-else>
              <div class="flex flex-col items-end gap-0.5">
                <p class="text-xs text-gray-600">¿Seguro?</p>
                <div class="flex gap-2">
                  <button @click="doDelete(banner.id)" class="text-xs text-red-600 font-semibold hover:underline">Sí</button>
                  <button @click="confirmingDelete = null" class="text-xs text-gray-500 hover:underline">No</button>
                </div>
                <p v-if="deleteError[banner.id]" class="text-xs text-red-500">{{ deleteError[banner.id] }}</p>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Formulario de upload -->
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 class="text-base font-bold text-gray-900 mb-4">Subir nuevo banner</h2>

        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Imagen <span class="text-gray-400">(jpg, png, webp — máx. 5 MB)</span></label>
            <input
              id="banner-file-input"
              type="file"
              accept="image/*"
              @change="onFileChange"
              class="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#E91E8C] file:text-white hover:file:opacity-90 cursor-pointer"
            />
            <p v-if="selectedFile" class="text-xs text-gray-400 mt-1">{{ selectedFile.name }}</p>
          </div>

          <div>
            <label class="block text-xs text-gray-500 mb-1">URL de enlace <span class="text-gray-400">(opcional — ej: /catalogo?categoria=3)</span></label>
            <input
              v-model="linkUrlInput"
              type="text"
              placeholder="https://... o /ruta/interna"
              class="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#E91E8C]"
            />
          </div>

          <p v-if="uploadError" class="text-xs text-red-500">{{ uploadError }}</p>

          <button
            :disabled="!selectedFile || uploading"
            @click="doUpload"
            class="h-9 px-5 rounded-lg bg-[#E91E8C] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
          >
            {{ uploading ? 'Subiendo…' : 'Subir banner' }}
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
