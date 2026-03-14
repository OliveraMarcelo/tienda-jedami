<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import VariantSelector from '@/components/features/catalog/VariantSelector.vue'
import StockMatrix from '@/components/features/catalog/StockMatrix.vue'
import CurvaCalculator from '@/components/features/catalog/CurvaCalculator.vue'
import SoftRegistrationGate from '@/components/features/catalog/SoftRegistrationGate.vue'
import { useProductsStore } from '@/stores/products.store'
import { useAuthStore } from '@/stores/auth.store'
import { useOrdersStore } from '@/stores/orders.store'
import { usePaymentsStore } from '@/stores/payments.store'
import { useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const productsStore = useProductsStore()
const authStore = useAuthStore()
const ordersStore = useOrdersStore()
const paymentsStore = usePaymentsStore()

const selectedColor = ref<string | null>(null)
const selectedSize = ref<string | null>(null)
const notFound = ref(false)

// Wholesale
const wholesaleTab = ref<'curva' | 'cantidad'>('curva')
const cantidadInput = ref(1)
const orderError = ref('')
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

// Retail
const showGate = ref(false)
const retailQuantity = ref(1)
const retailError = ref('')

function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 3500)
}

onMounted(async () => {
  try {
    await productsStore.loadProduct(Number(route.params.id))
    const variants = productsStore.currentProduct?.variants ?? []
    if (variants.length) {
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
  authStore.mode === 'wholesale' ? 'Precio mayorista' : 'Precio'
)

const totalStockForProduct = computed(() =>
  product.value?.variants.reduce((sum, v) => sum + v.stock.quantity, 0) ?? 0
)

async function handleCurvaConfirm(curves: number) {
  if (!product.value) return
  orderError.value = ''
  try {
    const order = await ordersStore.startWholesaleOrder('curva')
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

  try {
    const order = await ordersStore.placeRetailOrder([{ variantId: selectedVariant.value.id, quantity: qty }])
    await paymentsStore.startCheckout(order.id)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { detail?: string } } }
    retailError.value = e.response?.data?.detail ?? 'Error al crear el pedido'
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
  if (qty > totalStockForProduct.value) {
    orderError.value = `Stock disponible: ${totalStockForProduct.value} unidades`
    return
  }
  try {
    const order = await ordersStore.startWholesaleOrder('cantidad')
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
        <div class="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-6xl text-gray-300">
          🧸
        </div>

        <div class="space-y-5">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ product.name }}</h1>
            <p v-if="product.description" class="mt-2 text-gray-600">{{ product.description }}</p>
          </div>

          <div v-if="selectedVariant || product.variants.length">
            <p class="text-xs text-gray-500">{{ priceLabel }}</p>
            <p class="text-2xl font-bold text-gray-900">
              ${{ (selectedVariant?.retailPrice ?? Math.min(...product.variants.map(v => v.retailPrice))).toLocaleString('es-AR') }}
            </p>
          </div>

          <!-- Modo Mayorista -->
          <template v-if="authStore.isWholesale">
            <!-- Tabs -->
            <div class="flex gap-2 border-b border-gray-200">
              <button
                @click="wholesaleTab = 'curva'"
                :class="[
                  'pb-2 px-1 text-sm font-semibold border-b-2 transition-colors',
                  wholesaleTab === 'curva'
                    ? 'border-[#1565C0] text-[#1565C0]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                ]"
              >
                Por curva
              </button>
              <button
                @click="wholesaleTab = 'cantidad'"
                :class="[
                  'pb-2 px-1 text-sm font-semibold border-b-2 transition-colors',
                  wholesaleTab === 'cantidad'
                    ? 'border-[#1565C0] text-[#1565C0]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                ]"
              >
                Por cantidad
              </button>
            </div>

            <!-- Tab: Curva -->
            <CurvaCalculator
              v-if="wholesaleTab === 'curva'"
              :product="product"
              @confirm="handleCurvaConfirm"
            />

            <!-- Tab: Cantidad -->
            <div v-else class="space-y-4">
              <div class="bg-blue-50 rounded-xl border border-blue-100 p-4 text-sm text-blue-800">
                <p class="font-semibold mb-1">Compra por cantidad total</p>
                <p>Stock total disponible del producto: <strong>{{ totalStockForProduct }} unidades</strong></p>
                <p class="mt-1 text-xs text-blue-600">Las unidades se distribuirán automáticamente entre las variantes disponibles.</p>
              </div>

              <div class="flex items-center gap-3">
                <label class="text-sm font-semibold text-gray-700">Cantidad total</label>
                <input
                  v-model.number="cantidadInput"
                  type="number"
                  min="1"
                  :max="totalStockForProduct"
                  class="w-28 h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
                />
              </div>

              <p v-if="cantidadInput > totalStockForProduct && cantidadInput > 0" class="text-sm text-red-600">
                Stock disponible: {{ totalStockForProduct }} unidades
              </p>

              <button
                :disabled="!cantidadInput || cantidadInput <= 0 || cantidadInput > totalStockForProduct || ordersStore.loading"
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
              :disabled="!canBuy || ordersStore.loading || paymentsStore.loading"
              @click="handleBuyRetail"
              class="w-full h-10 rounded-xl bg-[#E91E8C] text-white font-semibold text-sm shadow hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              <span v-if="ordersStore.loading || paymentsStore.loading" class="inline-flex items-center gap-2">
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

          <div v-if="product.variants.length > 1" class="border-t pt-4">
            <p class="text-sm font-semibold text-gray-700 mb-3">Disponibilidad por talle y color</p>
            <StockMatrix :variants="product.variants" />
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
