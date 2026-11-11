<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ProductCard from '@/components/features/catalog/ProductCard.vue'
import VariantSelector from '@/components/features/catalog/VariantSelector.vue'
import CurvaCalculator from '@/components/features/catalog/CurvaCalculator.vue'
import SoftRegistrationGate from '@/components/features/catalog/SoftRegistrationGate.vue'
import DiscountRulesTable from '@/components/features/catalog/DiscountRulesTable.vue'
import { useProductsStore } from '@/stores/products.store'
import { useAuthStore } from '@/stores/auth.store'
import { useOrdersStore } from '@/stores/orders.store'
import { useConfigStore } from '@/stores/config.store'
import { useRouter } from 'vue-router'
import { MODES, PURCHASE_TYPES } from '@/lib/constants'
import { getPublicDiscountRules } from '@/api/discounts.api'
import { fetchProducts } from '@/api/products.api'
import type { QuantityDiscountRule, CurvaDiscountRule, Product } from '@/types/api'

const route = useRoute()
const router = useRouter()
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

// Escalones de descuento
const quantityRules = ref<QuantityDiscountRule[]>([])
const curvaRules = ref<CurvaDiscountRule[]>([])
const minQuantityPurchase = ref<number | null>(null)

// Hint dinámico: escalón que se activaría con la cantidad actual
const activeQuantityHint = computed(() => {
  if (!quantityRules.value.length) return null
  const qty = cantidadInput.value
  // Tomar el escalón de mayor min_quantity que sea <= qty
  const applicable = quantityRules.value
    .filter(r => r.min_quantity <= qty)
    .sort((a, b) => b.min_quantity - a.min_quantity)[0]
  return applicable ?? null
})

// Próximo escalón que aún no se alcanzó
const nextQuantityHint = computed(() => {
  if (!quantityRules.value.length) return null
  const qty = cantidadInput.value
  return quantityRules.value
    .filter(r => r.min_quantity > qty)
    .sort((a, b) => a.min_quantity - b.min_quantity)[0] ?? null
})

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

// Productos de la misma categoría para "También te puede gustar"
const related = ref<Product[]>([])

async function loadRelated(p: Product) {
  related.value = []
  try {
    const res = await fetchProducts(1, 9, p.categoryId ?? null)
    related.value = res.data.filter(r => r.id !== p.id).slice(0, 4)
  } catch {
    // Opcional: si falla, la sección no se muestra
  }
}

async function loadPage() {
  notFound.value = false
  activeImageIndex.value = 0
  selectedColor.value = null
  selectedSize.value = null
  retailQuantity.value = 1
  retailError.value = ''
  orderError.value = ''
  try {
    const productId = Number(route.params.id)
    await productsStore.loadProduct(productId)
    const variants = productsStore.currentProduct?.variants ?? []
    if (variants.length && variants[0]) {
      selectedColor.value = variants[0].color
    }
    if (productsStore.currentProduct) loadRelated(productsStore.currentProduct)
    // Cargar escalones de descuento — independiente del producto
    try {
      const rules = await getPublicDiscountRules(productId)
      quantityRules.value = rules.quantityRules
      curvaRules.value = rules.curvaRules
      minQuantityPurchase.value = rules.minQuantityPurchase ?? null
    } catch {
      // Si fallan los escalones el producto sigue visible
    }
  } catch {
    notFound.value = true
  }
}

onMounted(loadPage)
// Navegar de un producto a otro (relacionados) reutiliza el componente
watch(() => route.params.id, (id, prev) => {
  if (id && id !== prev) {
    loadPage()
    window.scrollTo({ top: 0 })
  }
})

const product = computed(() => productsStore.currentProduct)

// ─── Galería ────────────────────────────────────────────────────────────────
const gallery = computed<string[]>(() => {
  const p = product.value
  if (!p) return []
  if (p.images?.length) return [...p.images].sort((a, b) => a.position - b.position).map(i => i.url)
  return p.imageUrl ? [p.imageUrl] : []
})

function showImage(delta: number) {
  const n = gallery.value.length
  if (n < 2) return
  activeImageIndex.value = (activeImageIndex.value + delta + n) % n
}

// ─── Precio y stock ─────────────────────────────────────────────────────────
const displayPrice = computed(() => {
  const p = product.value
  if (!p) return null
  return authStore.mode === MODES.WHOLESALE ? (p.wholesalePrice ?? p.retailPrice) : p.retailPrice
})

const totalStock = computed(() => (product.value?.variants ?? []).reduce((sum, v) => sum + v.stock.quantity, 0))

const formatPrice = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

const whatsappUrl = computed(() => {
  const digits = (configStore.branding.whatsappNumber ?? '').replace(/\D/g, '')
  if (!digits || !product.value) return null
  const text = `Hola! Quería consultar por "${product.value.name}" (${window.location.href})`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
})

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
      role="status"
      class="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[var(--t-ink)] px-5 py-3 text-sm font-semibold text-white shadow-lg"
    >
      <span class="text-[var(--t-sun)]">✓</span> {{ toastMessage }}
    </div>

    <div v-if="notFound" class="py-20 text-center">
      <p class="mb-5 text-lg text-[var(--t-muted)]">No encontramos este producto.</p>
      <RouterLink
        to="/catalogo"
        class="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-[var(--t-ink)] px-8 text-sm font-semibold hover:bg-[var(--t-ink)] hover:text-white transition-colors"
      >
        Volver al catálogo
      </RouterLink>
    </div>

    <!-- Skeleton -->
    <div v-else-if="productsStore.loading && !product" class="grid animate-pulse grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
      <div class="aspect-[4/5] rounded-[var(--t-radius-card)] bg-[var(--t-surface)]"></div>
      <div class="space-y-4 pt-4">
        <div class="h-4 w-40 rounded-full bg-[var(--t-surface)]"></div>
        <div class="h-9 w-3/4 rounded-full bg-[var(--t-surface)]"></div>
        <div class="h-8 w-32 rounded-full bg-[var(--t-surface)]"></div>
        <div class="h-12 w-full rounded-full bg-[var(--t-surface)]"></div>
      </div>
    </div>

    <div v-else-if="product">
      <!-- Migas -->
      <nav aria-label="Ruta de navegación" class="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-[var(--t-muted)]">
        <RouterLink to="/catalogo" class="hover:text-[var(--t-ink)]">Inicio</RouterLink>
        <span aria-hidden="true">/</span>
        <template v-if="product.categoryId && product.categoryName">
          <RouterLink :to="{ path: '/catalogo', query: { categoria: product.categoryId } }" class="hover:text-[var(--t-ink)]">
            {{ product.categoryName }}
          </RouterLink>
          <span aria-hidden="true">/</span>
        </template>
        <span class="text-[var(--t-ink)] line-clamp-1" aria-current="page">{{ product.name }}</span>
      </nav>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <!-- Galería -->
        <div class="flex flex-col-reverse gap-3 sm:flex-row lg:sticky lg:top-28 lg:self-start">
          <div v-if="gallery.length > 1" class="flex gap-2.5 overflow-x-auto sm:max-h-[640px] sm:w-20 sm:shrink-0 sm:flex-col sm:overflow-y-auto">
            <button
              v-for="(url, idx) in gallery"
              :key="url"
              type="button"
              :aria-label="`Ver imagen ${idx + 1}`"
              :aria-current="activeImageIndex === idx ? 'true' : undefined"
              :class="[
                'aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors sm:w-full',
                activeImageIndex === idx ? 'border-[var(--t-ink)]' : 'border-transparent opacity-70 hover:opacity-100',
              ]"
              @click="activeImageIndex = idx"
            >
              <img :src="url" alt="" class="h-full w-full object-cover object-top" />
            </button>
          </div>

          <div class="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--t-radius-card)] bg-[var(--t-surface)]">
            <img
              v-if="gallery.length"
              :src="gallery[activeImageIndex] ?? gallery[0]"
              :alt="product.name"
              class="h-full w-full object-cover object-top"
            />
            <div v-else class="flex h-full items-center justify-center text-[var(--t-muted)]">
              <svg class="h-16 w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 5h18v14H3z" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>
            </div>

            <span
              v-if="totalStock === 0"
              class="absolute left-4 top-4 rounded-full bg-[var(--t-ink)] px-3 py-1.5 text-xs font-bold text-white"
            >Sin stock</span>

            <template v-if="gallery.length > 1">
              <button
                type="button"
                aria-label="Imagen anterior"
                class="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
                @click="showImage(-1)"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button
                type="button"
                aria-label="Imagen siguiente"
                class="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
                @click="showImage(1)"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <span class="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold">
                {{ activeImageIndex + 1 }} / {{ gallery.length }}
              </span>
            </template>
          </div>
        </div>

        <!-- Información y compra -->
        <div class="flex flex-col gap-6">
          <div>
            <p v-if="product.categoryName" class="mb-2 text-xs font-bold uppercase tracking-[2px] text-[var(--t-muted)]">
              {{ product.categoryName }}
            </p>
            <h1 class="text-2xl font-bold uppercase leading-tight tracking-[0.3px] sm:text-[32px]">{{ product.name }}</h1>
          </div>

          <div v-if="displayPrice !== null" class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span class="text-3xl font-bold text-[var(--t-price)]">{{ formatPrice(displayPrice) }}</span>
            <span
              v-if="authStore.mode === MODES.WHOLESALE"
              class="rounded-full bg-[var(--t-surface)] px-3 py-1 text-xs font-semibold"
            >Precio mayorista</span>
            <span
              v-else-if="product.wholesalePrice && product.wholesalePrice < (product.retailPrice ?? 0)"
              class="text-sm text-[var(--t-muted)]"
            >Por mayor: {{ formatPrice(product.wholesalePrice) }}</span>
          </div>

          <!-- Modo Mayorista -->
          <template v-if="authStore.mode === MODES.WHOLESALE">
            <div v-if="uniqueProductColors.length > 0">
              <p class="mb-2.5 text-sm font-semibold">Colores disponibles</p>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <span v-for="c in uniqueProductColors" :key="c.id" class="flex items-center gap-2 text-sm">
                  <span
                    class="h-6 w-6 flex-none rounded-full border"
                    :class="needsDarkBorder(c.hexCode) ? 'border-gray-400' : 'border-[var(--t-border)]'"
                    :style="{ backgroundColor: c.hexCode ?? '#BDBDBD' }"
                  />
                  {{ c.name }}
                </span>
              </div>
            </div>

            <!-- Modalidad de compra -->
            <div v-if="wholesaleTabs.length > 1" role="tablist" aria-label="Modalidad de compra" class="inline-flex self-start rounded-full bg-[var(--t-surface)] p-1">
              <button
                v-for="tab in wholesaleTabs"
                :key="tab.code"
                type="button"
                role="tab"
                :aria-selected="wholesaleTab === tab.code"
                :class="[
                  'min-h-10 rounded-full px-5 text-sm font-semibold transition-colors',
                  wholesaleTab === tab.code ? 'bg-[var(--t-ink)] text-white' : 'text-[var(--t-ink)] hover:bg-white',
                ]"
                @click="wholesaleTab = tab.code"
              >
                {{ tab.label }}
              </button>
            </div>

            <template v-if="wholesaleTab === 'curva'">
              <CurvaCalculator :product="product" @confirm="handleCurvaConfirm" />
              <DiscountRulesTable :quantity-rules="[]" :curva-rules="curvaRules" />
            </template>

            <div v-else-if="wholesaleTab === 'cantidad'" class="flex flex-col gap-4">
              <p class="text-sm text-[var(--t-muted)]">Las unidades se reparten automáticamente entre los talles y colores disponibles.</p>

              <DiscountRulesTable
                :quantity-rules="quantityRules"
                :curva-rules="[]"
                :min-quantity-purchase="minQuantityPurchase"
              />

              <div class="flex items-center gap-4">
                <span class="text-sm font-semibold" id="cantidad-label">Cantidad total</span>
                <div class="inline-flex items-center rounded-full border border-[var(--t-border)]" role="group" aria-labelledby="cantidad-label">
                  <button type="button" aria-label="Restar" class="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-[var(--t-surface)]" @click="cantidadInput = Math.max(1, cantidadInput - 1)">−</button>
                  <span class="min-w-[2.5rem] text-center font-semibold" aria-live="polite">{{ cantidadInput }}</span>
                  <button type="button" aria-label="Sumar" class="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-[var(--t-surface)]" @click="cantidadInput++">+</button>
                </div>
              </div>

              <p v-if="activeQuantityHint" class="rounded-2xl bg-[#E6F2EC] px-4 py-2.5 text-sm font-semibold text-[var(--t-price)]">
                ✓ Con {{ cantidadInput }} unidades tenés {{ activeQuantityHint.discount_pct }}% de descuento
              </p>
              <p v-else-if="nextQuantityHint" class="rounded-2xl bg-[var(--t-surface)] px-4 py-2.5 text-sm">
                Llevando {{ nextQuantityHint.min_quantity }} unidades tenés {{ nextQuantityHint.discount_pct }}% de descuento
              </p>

              <button
                type="button"
                :disabled="!cantidadInput || cantidadInput <= 0 || ordersStore.loading"
                class="min-h-12 w-full rounded-full bg-[var(--t-ink)] text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                @click="handleCantidadConfirm"
              >
                {{ ordersStore.loading ? 'Agregando…' : `Agregar ${cantidadInput} unidades al pedido` }}
              </button>
            </div>

            <div v-else class="rounded-2xl bg-[var(--t-surface)] p-4 text-sm text-[var(--t-muted)]">
              La modalidad "{{ configStore.purchaseTypeLabel[wholesaleTab] ?? wholesaleTab }}" estará disponible pronto.
            </div>

            <p v-if="orderError" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {{ orderError }}
            </p>
          </template>

          <!-- Modo Minorista / visitante -->
          <template v-else>
            <VariantSelector
              :variants="product.variants"
              :selected-color="selectedColor"
              :selected-size="selectedSize"
              @update:selected-color="selectedColor = $event"
              @update:selected-size="selectedSize = $event"
            />

            <div class="flex flex-col gap-3 sm:flex-row">
              <div
                v-if="selectedVariant && selectedVariant.stock.quantity > 0"
                class="inline-flex h-12 items-center justify-between self-start rounded-full border border-[var(--t-border)] sm:self-auto"
                role="group"
                aria-label="Cantidad"
              >
                <button type="button" aria-label="Restar" class="flex h-12 w-12 items-center justify-center rounded-full text-lg hover:bg-[var(--t-surface)]" @click="retailQuantity = Math.max(1, retailQuantity - 1)">−</button>
                <span class="min-w-[2rem] text-center font-semibold" aria-live="polite">{{ retailQuantity }}</span>
                <button type="button" aria-label="Sumar" class="flex h-12 w-12 items-center justify-center rounded-full text-lg hover:bg-[var(--t-surface)]" @click="retailQuantity = Math.min(selectedVariant.stock.quantity, retailQuantity + 1)">+</button>
              </div>

              <button
                type="button"
                :disabled="!canBuy || retailLoading"
                class="min-h-12 flex-1 rounded-full bg-[var(--t-ink)] px-8 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                @click="handleBuyRetail"
              >
                {{ retailLoading ? 'Procesando…' : totalStock === 0 ? 'Sin stock' : !selectedSize ? 'Elegí un talle' : 'Comprar ahora' }}
              </button>
            </div>

            <p v-if="retailError" role="alert" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {{ retailError }}
            </p>
          </template>

          <a
            v-if="whatsappUrl"
            :href="whatsappUrl"
            target="_blank"
            rel="noopener"
            class="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-[var(--t-ink)] px-8 text-sm font-semibold transition-colors hover:bg-[var(--t-ink)] hover:text-white"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.6z" /><path d="M9 9.5c.3 2.3 2.2 4.3 4.6 4.8l1.2-1.2 2 1-.6 1.7c-3.9.3-7.6-3.2-7.4-7.2L10.5 8l1 2z" /></svg>
            Consultar por WhatsApp
          </a>

          <!-- Beneficios -->
          <ul class="grid gap-3 rounded-[var(--t-radius-card)] bg-[var(--t-surface)] p-5 text-sm sm:grid-cols-2">
            <li class="flex items-start gap-3">
              <svg class="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 7h11v9H2zM13 10h4l3 3v3h-7zM6 18a1.8 1.8 0 1 0 0 .1M17 18a1.8 1.8 0 1 0 0 .1" /></svg>
              <span><strong class="font-semibold">Envíos a todo el país</strong><br><span class="text-[var(--t-muted)]">Coordinamos el envío por WhatsApp</span></span>
            </li>
            <li class="flex items-start gap-3">
              <svg class="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /></svg>
              <span><strong class="font-semibold">Mercado Pago o transferencia</strong><br><span class="text-[var(--t-muted)]">Pagá con QR o al alias</span></span>
            </li>
            <li class="flex items-start gap-3">
              <svg class="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10" /></svg>
              <span><strong class="font-semibold">Venta por mayor</strong><br><span class="text-[var(--t-muted)]">Precios especiales para comercios</span></span>
            </li>
            <li class="flex items-start gap-3">
              <svg class="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" /></svg>
              <span><strong class="font-semibold">Ropa para bebés y niños</strong><br><span class="text-[var(--t-muted)]">Telas suaves y cómodas</span></span>
            </li>
          </ul>

          <details v-if="product.description" open class="group border-t border-[var(--t-border)] pt-5">
            <summary class="flex cursor-pointer list-none items-center justify-between text-base font-semibold">
              Descripción
              <svg class="h-5 w-5 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </summary>
            <p class="mt-3 whitespace-pre-line leading-relaxed text-[var(--t-muted)]">{{ product.description }}</p>
          </details>

          <SoftRegistrationGate
            :open="showGate"
            @update:open="showGate = $event"
            @authenticated="handleBuyRetail"
          />
        </div>
      </div>

      <!-- Relacionados -->
      <section v-if="related.length" class="mt-16 sm:mt-20" aria-labelledby="related-title">
        <h2 id="related-title" class="mb-6 text-2xl font-bold sm:text-[28px]">También te puede gustar</h2>
        <div class="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          <ProductCard v-for="r in related" :key="r.id" :product="r" :mode="authStore.mode" />
        </div>
      </section>
    </div>
  </AppLayout>
</template>
