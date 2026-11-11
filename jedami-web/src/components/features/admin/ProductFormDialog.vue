<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import type { Product } from '@/types/api'
import { useProductsStore } from '@/stores/products.store'
import { uploadImage as apiUploadImage, deleteImage as apiDeleteImage, fetchProductDetail, reorderProductImages } from '@/api/admin.api'

const props = defineProps<{
  open: boolean
  product?: Product
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [data: { name: string; description: string; categoryId: number | null; retailPrice: number; wholesalePrice: number | null }]
  'image-changed': [value: { productId: number; imageUrl: string }]
}>()

const productsStore = useProductsStore()

const name = ref('')
const description = ref('')
const categoryId = ref<number | null>(null)
const retailPrice = ref<number | ''>('')
const wholesalePrice = ref<number | ''>('')
const localImages = ref<{ id: number; url: string; position: number }[]>([])
const imageError = ref('')
const imageLoading = ref(false)
const reorderSaving = ref(false)
const reorderSuccess = ref(false)
const reorderError = ref('')
const loading = ref(false)
const serverError = ref('')

watch(() => props.open, async (val) => {
  if (val) {
    name.value = props.product?.name ?? ''
    description.value = props.product?.description ?? ''
    categoryId.value = props.product?.categoryId ?? null
    retailPrice.value = props.product?.retailPrice ?? ''
    wholesalePrice.value = props.product?.wholesalePrice ?? ''
    imageError.value = ''
    serverError.value = ''
    reorderError.value = ''
    reorderSuccess.value = false
    localImages.value = []

    if (props.product) {
      try {
        const res = await fetchProductDetail(props.product.id)
        localImages.value = res.data.images ?? []
      } catch {
        // silencioso
      }
    }
  }
})

const isValid = () =>
  name.value.trim().length > 0 &&
  retailPrice.value !== '' && Number(retailPrice.value) >= 0

const title = () => props.product ? 'Editar producto' : 'Nuevo producto'

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!props.product) {
    imageError.value = 'Guardá el producto primero antes de agregar fotos'
    input.value = ''
    return
  }
  imageError.value = ''
  imageLoading.value = true
  try {
    const isFirst = localImages.value.length === 0
    const res = await apiUploadImage(props.product.id, file, localImages.value.length)
    localImages.value.push(res.data)
    if (isFirst && props.product) {
      emit('image-changed', { productId: props.product.id, imageUrl: res.data.url })
    }
  } catch {
    imageError.value = 'Error al subir la foto'
  } finally {
    imageLoading.value = false
    input.value = ''
  }
}

function moveImage(index: number, direction: 'up' | 'down') {
  const arr = [...localImages.value]
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= arr.length) return
  ;[arr[index], arr[swapWith]] = [arr[swapWith], arr[index]]
  localImages.value = arr
}

async function saveImageOrder() {
  if (!props.product) return
  reorderSaving.value = true
  reorderError.value = ''
  try {
    const items = localImages.value.map((img, i) => ({ id: img.id, position: i + 1 }))
    await reorderProductImages(props.product.id, items)
    reorderSuccess.value = true
    setTimeout(() => { reorderSuccess.value = false }, 2500)
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    reorderError.value = err?.response?.data?.detail ?? 'Error al guardar el orden'
  } finally {
    reorderSaving.value = false
  }
}

async function handleDeleteImage(imageId: number) {
  if (!props.product) return
  imageError.value = ''
  try {
    await apiDeleteImage(props.product.id, imageId)
    localImages.value = localImages.value.filter(img => img.id !== imageId)
  } catch {
    imageError.value = 'Error al eliminar la foto'
  }
}

async function handleSubmit() {
  if (!isValid()) return
  loading.value = true
  serverError.value = ''
  try {
    emit('saved', {
      name: name.value.trim(),
      description: description.value.trim(),
      categoryId: categoryId.value,
      retailPrice: Number(retailPrice.value),
      wholesalePrice: wholesalePrice.value !== '' ? Number(wholesalePrice.value) : null,
    })
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
    <h2 class="text-lg font-bold text-[var(--a-ink)] mb-4">{{ title() }}</h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block text-sm font-semibold text-[#45494E] mb-1">Nombre *</label>
        <input
          v-model="name"
          type="text"
          placeholder="Nombre del producto"
          class="flex h-10 w-full rounded-md border border-[#C9CDD2] px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--a-primary)]"
        />
      </div>

      <div>
        <label class="block text-sm font-semibold text-[#45494E] mb-1">Descripción</label>
        <textarea
          v-model="description"
          rows="3"
          placeholder="Descripción opcional"
          class="flex w-full rounded-md border border-[#C9CDD2] px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--a-primary)]"
        />
      </div>

      <!-- Categoría -->
      <div>
        <label class="block text-sm font-semibold text-[#45494E] mb-1">Categoría</label>
        <select
          v-model="categoryId"
          class="flex h-10 w-full rounded-md border border-[#C9CDD2] px-3 py-1 text-sm bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--a-primary)]"
        >
          <option :value="null">Sin categoría</option>
          <option v-for="cat in productsStore.categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
      </div>

      <!-- Precios -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-semibold text-[#45494E] mb-1">Precio minorista (ARS) *</label>
          <input
            v-model="retailPrice"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            class="flex h-10 w-full rounded-md border border-[#C9CDD2] px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--a-primary)]"
          />
        </div>
        <div>
          <label class="block text-sm font-semibold text-[#45494E] mb-1">Precio mayorista (ARS)</label>
          <input
            v-model="wholesalePrice"
            type="number"
            min="0"
            step="1"
            placeholder="Opcional"
            class="flex h-10 w-full rounded-md border border-[#C9CDD2] px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--a-primary)]"
          />
        </div>
      </div>

      <!-- Fotos -->
      <div>
        <label class="block text-sm font-semibold text-[#45494E] mb-2">Fotos</label>

        <div v-if="localImages.length > 0" class="mb-3">
          <div class="flex gap-2 flex-wrap">
            <div
              v-for="(img, index) in localImages"
              :key="img.id"
              class="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--a-border)] group"
            >
              <img :src="img.url" class="w-full h-full object-cover" />
              <!-- Badge Principal -->
              <span
                v-if="index === 0"
                class="absolute bottom-0 left-0 right-0 text-center text-[9px] font-semibold bg-[var(--a-primary)] text-white py-0.5 leading-tight"
              >Principal</span>
              <!-- Botón eliminar -->
              <button
                type="button"
                @click="handleDeleteImage(img.id)"
                class="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600 leading-none"
              >×</button>
              <!-- Botones reordenar -->
              <div class="absolute bottom-0.5 left-0.5 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  @click="moveImage(index, 'up')"
                  :disabled="index === 0"
                  class="bg-black/50 text-white rounded w-4 h-4 text-xs flex items-center justify-center disabled:opacity-20 hover:bg-black/70"
                  title="Mover arriba"
                >↑</button>
                <button
                  type="button"
                  @click="moveImage(index, 'down')"
                  :disabled="index === localImages.length - 1"
                  class="bg-black/50 text-white rounded w-4 h-4 text-xs flex items-center justify-center disabled:opacity-20 hover:bg-black/70"
                  title="Mover abajo"
                >↓</button>
              </div>
            </div>
          </div>
          <!-- Guardar orden -->
          <div class="mt-2 flex items-center gap-2">
            <button
              type="button"
              @click="saveImageOrder"
              :disabled="reorderSaving"
              class="text-xs px-3 py-1 rounded border border-[#C9CDD2] font-medium text-[#45494E] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {{ reorderSaving ? 'Guardando...' : 'Guardar orden' }}
            </button>
            <span v-if="reorderSuccess" class="text-xs text-green-600 font-medium">Orden guardado</span>
            <span v-if="reorderError" class="text-xs text-red-500">{{ reorderError }}</span>
          </div>
        </div>
        <p v-else-if="product" class="text-xs text-[var(--a-muted)] mb-2">Sin fotos. Agregá la primera.</p>
        <p v-else class="text-xs text-[var(--a-muted)] mb-2">Hacé clic en <strong>Guardar</strong> — el producto se crea y podés subir fotos sin cerrar este panel.</p>

        <div v-if="product">
          <label
            :class="[
              'flex items-center justify-center gap-2 h-10 px-4 rounded-md border-2 border-dashed text-sm font-medium cursor-pointer transition-colors',
              imageLoading
                ? 'border-[var(--a-border)] text-[var(--a-muted)] cursor-not-allowed'
                : 'border-[#C9CDD2] text-[var(--a-muted)] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)]',
            ]"
          >
            <span v-if="imageLoading">Subiendo...</span>
            <span v-else>+ Subir foto</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              class="hidden"
              :disabled="imageLoading"
              @change="handleFileSelected"
            />
          </label>
        </div>
        <p v-if="imageError" class="text-xs text-red-500 mt-1">{{ imageError }}</p>
      </div>

      <p v-if="serverError" class="text-sm text-red-500">{{ serverError }}</p>

      <div class="flex gap-2 justify-end pt-2">
        <button
          type="button"
          @click="$emit('update:open', false)"
          class="px-4 py-2 rounded-md border border-[#C9CDD2] text-sm font-medium text-[#45494E] hover:bg-[var(--a-bg)] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="loading || !isValid()"
          class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[var(--a-primary)] text-white text-sm font-semibold shadow hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
        >
          <svg v-if="loading" class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          {{ product ? 'Guardar' : 'Guardar y agregar fotos' }}
        </button>
      </div>
    </form>
  </Dialog>
</template>
