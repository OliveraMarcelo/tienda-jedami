<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AnnouncementSidebar from '@/components/features/catalog/AnnouncementSidebar.vue'
import VariantSelector from '@/components/features/catalog/VariantSelector.vue'
import CurvaCalculator from '@/components/features/catalog/CurvaCalculator.vue'
import SoftRegistrationGate from '@/components/features/catalog/SoftRegistrationGate.vue'
import { useProductsStore } from '@/stores/products.store'
import { useAuthStore } from '@/stores/auth.store'
import { useOrdersStore } from '@/stores/orders.store'
import { useConfigStore } from '@/stores/config.store'
import { useRouter } from 'vue-router'
import { MODES, PURCHASE_TYPES } from '@/lib/constants'

const route = useRoute()
const router = useRouter()
const showSidebar = ref(true) // true durante la carga para mostrar skeleton; false si no hay anuncios
const productsStore = useProductsStore()
const authStore = useAuthStore()
const ordersStore = useOrdersStore()
const configStore = useConfigStore()

const selectedColor = ref<string | null>(null)
const selectedSize = ref<string | null>(null)
const notFound = ref(false)
const activeImageIndex = ref(0)

// Wholesale — tabs generados desde config (excluye 'retail')
const wholesaleTabs = computed(() =>
  configStore.config.purchaseTypes.filter(pt => pt.code !== MODES.RETAIL)
)
const wholesaleTab = ref<string>('')
watchEffect(() => {
  if (!wholesaleTab.value && wholesaleTabs.value.length > 0) {
    wholesaleTab.value = wholesaleTabs.value[0]!.code
  }
})
const cantidadInput = ref(1)
const orderError = ref('')
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

// Retail
const showGate = ref(false)
const retailQuantity = ref(1)
const retailError = ref('')
const retailLoading = ref(false)

function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 3500)
}

onMounted(async () => {
  try {
    await productsStore.loadProduct(Number(route.params.id))
    const variants = productsStore.currentProduct?.variants ?? []
    if (variants.length && variants[0]) {
      selectedColor.value = variants[0].color
    }
  } catch {
    notFound.value = true
  }
})

const product = computed(() => productsStore.currentProduct)

const selectedVariant = computed(() =>
  product.value?.variants.find(
    v => v.color === selectedColor.value && v.size === selectedSize.value
  ) ?? null
)

const canBuy = computed(() =>
  !!selectedVariant.value && selectedVariant.value.stock.quantity > 0
)

// Resetear cantidad al cambiar variante para que nunca exceda el stock disponible
watch(selectedVariant, () => {
  retailQuantity.value = 1
})

const priceLabel = computed(() =>
  authStore.mode === MODES.WHOLESALE ? 'Precio mayorista' : 'Precio'
)

// Colores únicos del producto (para mostrar en modo mayorista)
const uniqueProductColors = computed(() => {
  const seen = new Set<number>()
  const result: { id: number; name: string; hexCode: string | null }[] = []
  for (const v of product.value?.variants ?? []) {
    if (!seen.has(v.colorId)) {
      seen.add(v.colorId)
      result.push({ id: v.colorId, name: v.color, hexCode: v.hexCode })
    }
  }
  return result
})

function needsDarkBorder(hexCode: string | null): boolean {
  if (!hexCode) return false
  const light = ['#FFFFFF', '#FFF', '#FFF176', '#F5F5DC', '#D7CCC8', '#F48FB1', '#81D4FA', '#A5D6A7', '#EF9A9A', '#FFCC80', '#CE93D8']
  return light.some(c => hexCode.toUpperCase().startsWith(c.toUpperCase()))
}

async function handleCurvaConfirm(curves: number) {
  if (!product.value) return
  orderError.value = ''
  try {
    const order = await ordersStore.startWholesaleOrder(PURCHASE_TYPES.CURVA)
    await ordersStore.addItem(order.id, { productId: product.value.id, curves })
    showToast('Agregado al pedido')
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    orderError.value = e.response?.data?.detail ?? 'Error al agregar al pedido'
  }
}

async function handleBuyRetail() {
  if (!selectedVariant.value) return
  retailError.value = ''

  if (!authStore.isAuthenticated) {
    showGate.value = true
    return
  }

  const qty = retailQuantity.value
  if (!qty || qty <= 0) {
    retailError.value = 'La cantidad debe ser mayor a 0'
    return
  }
  if (qty > selectedVariant.value.stock.quantity) {
    retailError.value = `Stock disponible: ${selectedVariant.value.stock.quantity} unidades`
    return
  }

  retailLoading.value = true
  try {
    const order = await ordersStore.placeRetailOrder([{ variantId: selectedVariant.value.id, quantity: qty }])
    router.push('/pedidos/' + order.id)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    retailError.value = e.response?.data?.detail ?? 'Error al crear el pedido'
  } finally {
    retailLoading.value = false
  }
}

async function handleCantidadConfirm() {
  if (!product.value) return
  orderError.value = ''
  const qty = cantidadInput.value
  if (!qty || qty <= 0) {
    orderError.value = 'La cantidad debe ser mayor a 0'
    return
  }
  try {
    const order = await ordersStore.startWholesaleOrder(PURCHASE_TYPES.CANTIDAD)
    await ordersStore.addItem(order.id, { productId: product.value.id, quantity: qty })
    showToast('Agregado al pedido')
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    orderError.value = e.response?.data?.detail ?? 'Error al agregar al pedido'
  }
}
</script>

<template>
  <AppLayout>
    <!-- Toast -->
    <div
      v-if="toastMessage"
      class="fixed bottom-6 right-6 z-50 bg-green-50 border border-green-200 text-green-900 rounded-xl px-4 py-3 shadow-lg text-sm font-semibold flex items-center gap-2"
    >
      <span class="text-green-600">✓</span> {{ toastMessage }}
    </div>

    <div v-if="notFound" class="text-center py-16">
      <p class="text-gray-500 mb-4">Producto no encontrado.</p>
      <RouterLink to="/catalogo" class="text-[#E91E8C] hover:underline font-semibold">
        Volver al catálogo
      </RouterLink>
    </div>

    <div v-else-if="productsStore.loading && !product" class="animate-pulse">
      <div class="h-8 bg-gray-200 rounded w-64 mb-4"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="aspect-square bg-gray-200 rounded-2xl"></div>
        <div class="space-y-4">
          <div class="h-6 bg-gray-200 rounded w-48"></div>
          <div class="h-4 bg-gray-200 rounded w-full"></div>
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    </div>

    <div v-else-if="product">
      <RouterLink to="/catalogo" class="text-sm text-gray-500 hover:text-[#E91E8C] mb-4 inline-block">
        ← Catálogo
      </RouterLink>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
        <!-- Galería de imágenes -->
        <div>
          <div class="aspect-square bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center text-6xl text-gray-300">
            <img
              v-if="product.images && product.images.length > 0"
              :src="product.images![activeImageIndex]?.url ?? product.images![0]!.url"
              :alt="product.name"
              class="w-full h-full object-cover"
            />
            <img
              v-else-if="product.imageUrl"
              :src="product.imageUrl"
              :alt="product.name"
              class="w-full h-full object-cover"
            />
            <span v-else>🧸</span>
          </div>
          <!-- Miniaturas -->
          <div
            v-if="product.images && product.images.length > 1"
            class="flex gap-2 mt-3 overflow-x-auto pb-1"
          >
            <button
              v-for="(img, idx) in product.images"
              :key="img.id"
              @click="activeImageIndex = idx"
              :class="[
                'flex-none w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors',
                activeImageIndex === idx ? 'border-[#E91E8C]' : 'border-transparent hover:border-gray-300',
              ]"
            >
              <img :src="img.url" :alt="`Imagen ${idx + 1}`" class="w-full h-full object-cover" />
            </button>
          </div>
        </div>

        <div class="space-y-5">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ product.name }}</h1>
            <p v-if="product.description" class="mt-2 text-gray-600">{{ product.description }}</p>
          </div>

          <div v-if="product.retailPrice !== null">
            <p class="text-xs text-gray-500">{{ priceLabel }}</p>
            <p class="text-2xl font-bold text-gray-900">
              ${{ (authStore.mode === MODES.WHOLESALE ? (product.wholesalePrice ?? product.retailPrice ?? 0) : (product.retailPrice ?? 0)).toLocaleString('es-AR') }}
            </p>
          </div>

          <!-- Modo Mayorista -->
          <template v-if="authStore.mode === MODES.WHOLESALE">
            <!-- Colores disponibles -->
            <div v-if="uniqueProductColors.length > 0">
              <p class="text-xs font-semibold text-gray-500 mb-2">Colores disponibles</p>
              <div class="flex gap-2 flex-wrap">
                <div
                  v-for="c in uniqueProductColors"
                  :key="c.id"
                  :title="c.name"
                  class="flex items-center gap-1.5"
                >
                  <span
                    class="w-6 h-6 rounded-full border-2 flex-none"
                    :class="needsDarkBorder(c.hexCode) ? 'border-gray-400' : 'border-gray-300'"
                    :style="c.hexCode ? { backgroundColor: c.hexCode } : { backgroundColor: '#BDBDBD' }"
                  />
                  <span class="text-xs text-gray-600">{{ c.name }}</span>
                </div>
              </div>
            </div>

            <!-- Tabs dinámicos desde config -->
            <div class="flex gap-2 border-b border-gray-200">
              <button
                v-for="tab in wholesaleTabs"
                :key="tab.code"
                @click="wholesaleTab = tab.code"
                :class="[
                  'pb-2 px-1 text-sm font-semibold border-b-2 transition-colors',
                  wholesaleTab === tab.code
                    ? 'border-[#1565C0] text-[#1565C0]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                ]"
              >
                <span v-if="tab.icon" class="mr-1">{{ tab.icon }}</span>{{ tab.label }}
              </button>
            </div>

            <!-- Tab: Curva -->
            <CurvaCalculator
              v-if="wholesaleTab === 'curva'"
              :product="product"
              @confirm="handleCurvaConfirm"
            />

            <!-- Tab: Cantidad -->
            <div v-else-if="wholesaleTab === 'cantidad'" class="space-y-4">
              <p class="text-sm text-gray-500">Las unidades se distribuirán automáticamente entre las variantes disponibles.</p>

              <div class="flex items-center gap-3">
                <label class="text-sm font-semibold text-gray-700">Cantidad total</label>
                <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    @click="cantidadInput = Math.max(1, cantidadInput - 1)"
                    class="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                  >−</button>
                  <span class="px-3 py-1.5 text-sm font-semibold min-w-[2.5rem] text-center">{{ cantidadInput }}</span>
                  <button
                    type="button"
                    @click="cantidadInput++"
                    class="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                  >+</button>
                </div>
              </div>

              <button
                :disabled="!cantidadInput || cantidadInput <= 0 || ordersStore.loading"
                @click="handleCantidadConfirm"
                class="w-full h-10 rounded-xl bg-[#1565C0] text-white font-semibold text-sm shadow hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >
                <span v-if="ordersStore.loading" class="inline-flex items-center gap-2">
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Agregando…
                </span>
                <span v-else>Agregar {{ cantidadInput }} uds. al pedido</span>
              </button>
            </div>

            <!-- Tab desconocido (por si se agrega un tipo nuevo sin UI específica) -->
            <div v-else class="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
              Modalidad "{{ configStore.purchaseTypeLabel[wholesaleTab] ?? wholesaleTab }}" próximamente disponible.
            </div>

            <!-- Error inline -->
            <p v-if="orderError" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {{ orderError }}
            </p>
          </template>

          <!-- Modo Minorista/Visitante -->
          <template v-else>
            <VariantSelector
              :variants="product.variants"
              :selected-color="selectedColor"
              :selected-size="selectedSize"
              @update:selected-color="selectedColor = $event"
              @update:selected-size="selectedSize = $event"
            />

            <!-- Cantidad -->
            <div v-if="selectedVariant && selectedVariant.stock.quantity > 0" class="flex items-center gap-3">
              <label class="text-sm font-semibold text-gray-700">Cantidad</label>
              <div class="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  @click="retailQuantity = Math.max(1, retailQuantity - 1)"
                  class="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                >−</button>
                <span class="px-3 py-1.5 text-sm font-semibold min-w-[2rem] text-center">{{ retailQuantity }}</span>
                <button
                  type="button"
                  @click="retailQuantity = Math.min(selectedVariant.stock.quantity, retailQuantity + 1)"
                  class="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                >+</button>
              </div>
              <span class="text-xs text-gray-400">máx. {{ selectedVariant.stock.quantity }}</span>
            </div>

            <button
              :disabled="!canBuy || retailLoading"
              @click="handleBuyRetail"
              class="w-full h-10 rounded-xl bg-[#E91E8C] text-white font-semibold text-sm shadow hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              <span v-if="retailLoading" class="inline-flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Procesando…
              </span>
              <span v-else>Comprar ahora</span>
            </button>

            <p v-if="retailError" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {{ retailError }}
            </p>
          </template>

          <SoftRegistrationGate
            :open="showGate"
            @update:open="showGate = $event"
            @authenticated="handleBuyRetail"
          />

        </div>
      </div>
    </div>

  <template v-if="showSidebar" #sidebar>
    <AnnouncementSidebar @has-content="showSidebar = $event" />
  </template>
  </AppLayout>
</template>
