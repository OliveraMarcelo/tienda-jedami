<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import type { Product } from '@/types/api'
import { useProductsStore } from '@/stores/products.store'
import { useAdminProductsStore } from '@/stores/admin.products.store'

const props = defineProps<{
  open: boolean
  product?: Product
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [data: { name: string; description: string; categoryId: number | null }]
}>()

const productsStore = useProductsStore()
const adminStore = useAdminProductsStore()

const name = ref('')
const description = ref('')
const categoryId = ref<number | null>(null)
const newImageUrl = ref('')
const imageError = ref('')
const loading = ref(false)
const serverError = ref('')

watch(() => props.open, (val) => {
  if (val) {
    name.value = props.product?.name ?? ''
    description.value = props.product?.description ?? ''
    categoryId.value = props.product?.categoryId ?? null
    newImageUrl.value = ''
    imageError.value = ''
    serverError.value = ''
    productsStore.loadCategories()
  }
})

const isValid = computed(() => name.value.trim().length > 0)
const title = computed(() => props.product ? 'Editar producto' : 'Nuevo producto')

const images = computed(() => props.product?.images ?? [])

async function handleAddImage() {
  const url = newImageUrl.value.trim()
  if (!url) return
  if (!url.startsWith('http')) {
    imageError.value = 'Ingresá una URL válida (debe empezar con http)'
    return
  }
  if (!props.product) {
    imageError.value = 'Guardá el producto primero antes de agregar fotos'
    return
  }
  imageError.value = ''
  try {
    await adminStore.addImage(props.product.id, url, images.value.length)
    newImageUrl.value = ''
  } catch {
    imageError.value = 'Error al agregar la foto'
  }
}

async function handleDeleteImage(imageId: number) {
  if (!props.product) return
  try {
    await adminStore.deleteImage(props.product.id, imageId)
  } catch {
    imageError.value = 'Error al eliminar la foto'
  }
}

async function handleSubmit() {
  if (!isValid.value) return
  loading.value = true
  serverError.value = ''
  try {
    emit('saved', {
      name: name.value.trim(),
      description: description.value.trim(),
      categoryId: categoryId.value,
    })
    emit('update:open', false)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    serverError.value = e.response?.data?.detail ?? 'Error al guardar'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <h2 class="text-lg font-bold text-gray-900 mb-4">{{ title }}</h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Nombre *</label>
        <input
          v-model="name"
          type="text"
          placeholder="Nombre del producto"
          class="flex h-9 w-full rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E91E8C]"
        />
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Descripción</label>
        <textarea
          v-model="description"
          rows="3"
          placeholder="Descripción opcional"
          class="flex w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E91E8C]"
        />
      </div>

      <!-- Categoría -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Categoría</label>
        <select
          v-model="categoryId"
          class="flex h-9 w-full rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E91E8C]"
        >
          <option :value="null">Sin categoría</option>
          <option v-for="cat in productsStore.categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
      </div>

      <!-- Fotos -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">Fotos</label>

        <!-- Miniaturas existentes -->
        <div v-if="images.length > 0" class="flex gap-2 flex-wrap mb-3">
          <div
            v-for="img in images"
            :key="img.id"
            class="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200"
          >
            <img :src="img.url" class="w-full h-full object-cover" />
            <button
              type="button"
              @click="handleDeleteImage(img.id)"
              class="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600 leading-none"
              title="Eliminar foto"
            >
              ×
            </button>
          </div>
        </div>
        <p v-else-if="product" class="text-xs text-gray-400 mb-2">Sin fotos. Agregá la primera.</p>
        <p v-else class="text-xs text-gray-400 mb-2">Guardá el producto primero para poder agregar fotos.</p>

        <!-- Agregar nueva URL -->
        <div v-if="product" class="flex gap-2">
          <input
            v-model="newImageUrl"
            type="url"
            placeholder="https://ejemplo.com/foto.jpg"
            class="flex-1 h-9 rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E91E8C]"
            @keydown.enter.prevent="handleAddImage"
          />
          <button
            type="button"
            @click="handleAddImage"
            class="px-3 h-9 rounded-md bg-gray-100 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            + Agregar
          </button>
        </div>
        <p v-if="imageError" class="text-xs text-red-500 mt-1">{{ imageError }}</p>
      </div>

      <p v-if="serverError" class="text-sm text-red-500">{{ serverError }}</p>

      <div class="flex gap-2 justify-end pt-2">
        <button
          type="button"
          @click="$emit('update:open', false)"
          class="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="loading || !isValid"
          class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#E91E8C] text-white text-sm font-semibold shadow hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
        >
          <svg v-if="loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Guardar
        </button>
      </div>
    </form>
  </Dialog>
</template>
