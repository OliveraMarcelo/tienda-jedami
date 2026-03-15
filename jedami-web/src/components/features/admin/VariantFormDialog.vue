<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import { useProductsStore } from '@/stores/products.store'

const props = defineProps<{
  open: boolean
  productId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [data: { sizeId: number; colorId: number; initialStock: number }]
}>()

const productsStore = useProductsStore()

const sizeId = ref<number | ''>('')
const colorId = ref<number | ''>('')
const initialStock = ref<number | ''>('')
const loading = ref(false)
const serverError = ref('')

watch(() => props.open, async (val) => {
  if (val) {
    sizeId.value = ''
    colorId.value = ''
    initialStock.value = ''
    serverError.value = ''
    await Promise.all([
      productsStore.loadSizes(),
      productsStore.loadColors(),
    ])
  }
})

const isValid = computed(() =>
  sizeId.value !== '' &&
  colorId.value !== '' &&
  initialStock.value !== '' && Number(initialStock.value) >= 0
)

async function handleSubmit() {
  if (!isValid.value) return
  loading.value = true
  serverError.value = ''
  try {
    emit('saved', {
      sizeId: Number(sizeId.value),
      colorId: Number(colorId.value),
      initialStock: Number(initialStock.value),
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
    <h2 class="text-lg font-bold text-gray-900 mb-4">Agregar variante</h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Talle *</label>
          <select
            v-model="sizeId"
            class="flex h-9 w-full rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E91E8C]"
          >
            <option value="">Seleccionar talle</option>
            <option v-for="s in productsStore.sizes" :key="s.id" :value="s.id">
              {{ s.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">Color *</label>
          <select
            v-model="colorId"
            class="flex h-9 w-full rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E91E8C]"
          >
            <option value="">Seleccionar color</option>
            <option v-for="c in productsStore.colors" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Stock inicial *</label>
        <input
          v-model="initialStock"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          class="flex h-9 w-full rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E91E8C]"
        />
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
          Agregar
        </button>
      </div>
    </form>
  </Dialog>
</template>
