<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useConfigStore } from '@/stores/config.store'
import {
  fetchPurchaseTypes, createPurchaseType, updatePurchaseType,
  fetchCustomerTypes, createCustomerType, updateCustomerType,
  fetchSizes, createSize, deleteSize,
  fetchColors, createColor, deleteColor,
  updateBranding, uploadBrandingLogo, updatePaymentGateway,
  type ConfigTypeItem, type SizeItem, type ColorItem,
} from '@/api/admin.config.api'
import type { BrandingConfig } from '@/api/config.api'

const router = useRouter()
const configStore = useConfigStore()

type Tab = 'purchase-types' | 'customer-types' | 'sizes' | 'colors' | 'branding' | 'payments'
const activeTab = ref<Tab>('purchase-types')

// ─── Purchase Types ───────────────────────────────────────────────────────────
const purchaseTypes = ref<ConfigTypeItem[]>([])
const ptLoading = ref(false)
const ptNew = ref({ code: '', label: '' })
const ptSaving = ref(false)
const ptError = ref('')

async function loadPurchaseTypes() {
  ptLoading.value = true
  try { purchaseTypes.value = await fetchPurchaseTypes() }
  finally { ptLoading.value = false }
}

async function addPurchaseType() {
  if (!ptNew.value.code || !ptNew.value.label) return
  ptSaving.value = true
  ptError.value = ''
  try {
    const item = await createPurchaseType(ptNew.value)
    purchaseTypes.value.push(item)
    ptNew.value = { code: '', label: '' }
    await configStore.refreshConfig()
  } catch (e: any) {
    ptError.value = e?.response?.data?.detail ?? 'Error al guardar. Verificá que el código no esté duplicado.'
  } finally { ptSaving.value = false }
}

async function togglePurchaseType(item: ConfigTypeItem) {
  ptError.value = ''
  try {
    const updated = await updatePurchaseType(item.id, { active: !item.active })
    const idx = purchaseTypes.value.findIndex(x => x.id === item.id)
    if (idx !== -1) purchaseTypes.value[idx] = updated
    await configStore.refreshConfig()
  } catch (e: any) {
    ptError.value = e?.response?.data?.detail ?? 'Error al actualizar.'
  }
}

// ─── Customer Types ───────────────────────────────────────────────────────────
const customerTypes = ref<ConfigTypeItem[]>([])
const ctLoading = ref(false)
const ctNew = ref({ code: '', label: '' })
const ctSaving = ref(false)
const ctError = ref('')

async function loadCustomerTypes() {
  ctLoading.value = true
  try { customerTypes.value = await fetchCustomerTypes() }
  finally { ctLoading.value = false }
}

async function addCustomerType() {
  if (!ctNew.value.code || !ctNew.value.label) return
  ctSaving.value = true
  ctError.value = ''
  try {
    const item = await createCustomerType(ctNew.value)
    customerTypes.value.push(item)
    ctNew.value = { code: '', label: '' }
    await configStore.refreshConfig()
  } catch (e: any) {
    ctError.value = e?.response?.data?.detail ?? 'Error al guardar. Verificá que el código no esté duplicado.'
  } finally { ctSaving.value = false }
}

async function toggleCustomerType(item: ConfigTypeItem) {
  ctError.value = ''
  try {
    const updated = await updateCustomerType(item.id, { active: !item.active })
    const idx = customerTypes.value.findIndex(x => x.id === item.id)
    if (idx !== -1) customerTypes.value[idx] = updated
    await configStore.refreshConfig()
  } catch (e: any) {
    ctError.value = e?.response?.data?.detail ?? 'Error al actualizar.'
  }
}

// ─── Sizes ────────────────────────────────────────────────────────────────────
const sizes = ref<SizeItem[]>([])
const szLoading = ref(false)
const szNew = ref({ label: '', sortOrder: 0 })
const szSaving = ref(false)
const szDeleting = ref<number | null>(null)
const szError = ref('')

async function loadSizes() {
  szLoading.value = true
  try { sizes.value = await fetchSizes() }
  finally { szLoading.value = false }
}

async function addSize() {
  if (!szNew.value.label) return
  szSaving.value = true
  szError.value = ''
  try {
    const item = await createSize({ label: szNew.value.label, sortOrder: szNew.value.sortOrder })
    sizes.value.push(item)
    szNew.value = { label: '', sortOrder: 0 }
  } catch (e: any) {
    szError.value = e?.response?.data?.detail ?? 'Error al guardar.'
  } finally { szSaving.value = false }
}

async function removeSize(id: number) {
  szDeleting.value = id
  szError.value = ''
  try {
    await deleteSize(id)
    sizes.value = sizes.value.filter(s => s.id !== id)
  } catch (e: any) {
    szError.value = e?.response?.data?.detail ?? 'No se pudo eliminar el talle.'
  } finally { szDeleting.value = null }
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const colors = ref<ColorItem[]>([])
const clLoading = ref(false)
const clNew = ref({ name: '', hexCode: '#000000' })
const clSaving = ref(false)
const clDeleting = ref<number | null>(null)
const clError = ref('')

async function loadColors() {
  clLoading.value = true
  try { colors.value = await fetchColors() }
  finally { clLoading.value = false }
}

async function addColor() {
  if (!clNew.value.name) return
  clSaving.value = true
  clError.value = ''
  try {
    const item = await createColor({ name: clNew.value.name, hexCode: clNew.value.hexCode || undefined })
    colors.value.push(item)
    clNew.value = { name: '', hexCode: '#000000' }
  } catch (e: any) {
    clError.value = e?.response?.data?.detail ?? 'Error al guardar.'
  } finally { clSaving.value = false }
}

async function removeColor(id: number) {
  clDeleting.value = id
  clError.value = ''
  try {
    await deleteColor(id)
    colors.value = colors.value.filter(c => c.id !== id)
  } catch (e: any) {
    clError.value = e?.response?.data?.detail ?? 'No se pudo eliminar el color.'
  } finally { clDeleting.value = null }
}

// ─── Branding ─────────────────────────────────────────────────────────────────
const brandingForm = ref<BrandingConfig>({ ...configStore.branding })
const brandingSaving = ref(false)
const brandingSuccess = ref(false)
const logoUploading = ref(false)
const logoError = ref('')

function applyBrandingToStore(updated: BrandingConfig) {
  configStore.branding.storeName = updated.storeName
  configStore.branding.primaryColor = updated.primaryColor
  configStore.branding.secondaryColor = updated.secondaryColor
  configStore.branding.logoUrl = updated.logoUrl
  brandingForm.value.logoUrl = updated.logoUrl
}

async function saveBranding() {
  brandingSaving.value = true
  brandingSuccess.value = false
  try {
    const updated = await updateBranding(brandingForm.value)
    applyBrandingToStore(updated)
    brandingSuccess.value = true
    setTimeout(() => { brandingSuccess.value = false }, 2500)
  } finally { brandingSaving.value = false }
}

async function handleLogoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  logoError.value = ''
  logoUploading.value = true
  try {
    const updated = await uploadBrandingLogo(file)
    applyBrandingToStore(updated)
  } catch {
    logoError.value = 'Error al subir el logo'
  } finally {
    logoUploading.value = false
    input.value = ''
  }
}

// ─── Payment Gateway ──────────────────────────────────────────────────────────
const paymentGateway = ref<'checkout_pro' | 'checkout_api' | 'bank_transfer'>(
  (configStore.config.paymentGateway as 'checkout_pro' | 'checkout_api' | 'bank_transfer') ?? 'checkout_pro'
)
const gatewaySaving = ref(false)
const gatewaySuccess = ref(false)
const gatewayError = ref('')

async function savePaymentGateway() {
  gatewaySaving.value = true
  gatewaySuccess.value = false
  gatewayError.value = ''
  try {
    await updatePaymentGateway(paymentGateway.value)
    configStore.config.paymentGateway = paymentGateway.value
    gatewaySuccess.value = true
    setTimeout(() => { gatewaySuccess.value = false }, 2500)
  } catch (e: any) {
    gatewayError.value = e?.response?.data?.detail ?? 'Error al guardar'
  } finally {
    gatewaySaving.value = false
  }
}

// ─── Bank Transfer Data ────────────────────────────────────────────────────────
const bankTransferForm = ref({
  bankTransferCvu:        configStore.branding.bankTransferCvu        ?? '',
  bankTransferAlias:      configStore.branding.bankTransferAlias      ?? '',
  bankTransferHolderName: configStore.branding.bankTransferHolderName ?? '',
  bankTransferBankName:   configStore.branding.bankTransferBankName   ?? '',
  bankTransferNotes:      configStore.branding.bankTransferNotes      ?? '',
  whatsappNumber:         configStore.branding.whatsappNumber         ?? '',
})
const bankTransferSaving = ref(false)
const bankTransferSuccess = ref(false)
const bankTransferError = ref('')

async function saveBankTransfer() {
  bankTransferSaving.value = true
  bankTransferSuccess.value = false
  bankTransferError.value = ''
  try {
    const updated = await updateBranding({
      bankTransferCvu:        bankTransferForm.value.bankTransferCvu        || null,
      bankTransferAlias:      bankTransferForm.value.bankTransferAlias      || null,
      bankTransferHolderName: bankTransferForm.value.bankTransferHolderName || null,
      bankTransferBankName:   bankTransferForm.value.bankTransferBankName   || null,
      bankTransferNotes:      bankTransferForm.value.bankTransferNotes      || null,
      whatsappNumber:         bankTransferForm.value.whatsappNumber         || null,
    })
    configStore.branding.bankTransferCvu        = updated.bankTransferCvu
    configStore.branding.bankTransferAlias      = updated.bankTransferAlias
    configStore.branding.bankTransferHolderName = updated.bankTransferHolderName
    configStore.branding.bankTransferBankName   = updated.bankTransferBankName
    configStore.branding.bankTransferNotes      = updated.bankTransferNotes
    configStore.branding.whatsappNumber         = updated.whatsappNumber
    bankTransferSuccess.value = true
    setTimeout(() => { bankTransferSuccess.value = false }, 2500)
  } catch (e: any) {
    bankTransferError.value = e?.response?.data?.detail ?? 'Error al guardar'
  } finally {
    bankTransferSaving.value = false
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadPurchaseTypes(), loadCustomerTypes(), loadSizes(), loadColors()])
  brandingForm.value = { ...configStore.branding }
})

const TABS: { key: Tab; label: string }[] = [
  { key: 'purchase-types', label: 'Tipos de Compra' },
  { key: 'customer-types', label: 'Tipos de Cliente' },
  { key: 'sizes',          label: 'Talles' },
  { key: 'colors',         label: 'Colores' },
  { key: 'branding',       label: 'Branding' },
  { key: 'payments',       label: 'Pagos' },
]
</script>

<template>
  <AppLayout>
    <div class="max-w-3xl mx-auto">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/admin')" class="text-sm text-gray-500 hover:text-[var(--color-primary)]">← Admin</button>
        <h1 class="text-2xl font-bold text-gray-900">Configuración</h1>
      </div>

      <!-- Tabs -->
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-1 overflow-x-auto">
          <button
            v-for="tab in TABS"
            :key="tab.key"
            @click="activeTab = tab.key"
            class="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            :class="activeTab === tab.key
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >{{ tab.label }}</button>
        </nav>
      </div>

      <!-- ── Tipos de Compra ── -->
      <div v-if="activeTab === 'purchase-types'">
        <div v-if="ptLoading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="animate-pulse bg-white rounded-xl border h-12"></div>
        </div>
        <template v-else>
          <div class="space-y-2 mb-4">
            <div
              v-for="item in purchaseTypes" :key="item.id"
              class="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between"
            >
              <div>
                <span class="font-semibold text-gray-800 text-sm">{{ item.label }}</span>
                <span class="ml-2 text-xs text-gray-400 font-mono">{{ item.code }}</span>
              </div>
              <button
                @click="togglePurchaseType(item)"
                class="text-xs font-semibold px-3 py-1 rounded-full border transition-colors"
                :class="item.active
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'"
              >{{ item.active ? 'Activo' : 'Inactivo' }}</button>
            </div>
          </div>
          <!-- Formulario alta -->
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-sm font-semibold text-gray-700 mb-3">Agregar tipo de compra</p>
            <div class="flex flex-wrap gap-2 items-end">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Código</label>
                <input v-model="ptNew.code" type="text" placeholder="ej: mayoreo" class="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Etiqueta</label>
                <input v-model="ptNew.label" type="text" placeholder="ej: Por mayoreo" class="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
              </div>
              <button
                @click="addPurchaseType"
                :disabled="ptSaving || !ptNew.code || !ptNew.label"
                class="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >Agregar</button>
            </div>
            <p v-if="ptError" class="text-xs text-red-500 mt-2">{{ ptError }}</p>
          </div>
        </template>
      </div>

      <!-- ── Tipos de Cliente ── -->
      <div v-if="activeTab === 'customer-types'">
        <div v-if="ctLoading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="animate-pulse bg-white rounded-xl border h-12"></div>
        </div>
        <template v-else>
          <div class="space-y-2 mb-4">
            <div
              v-for="item in customerTypes" :key="item.id"
              class="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between"
            >
              <div>
                <span class="font-semibold text-gray-800 text-sm">{{ item.label }}</span>
                <span class="ml-2 text-xs text-gray-400 font-mono">{{ item.code }}</span>
              </div>
              <button
                @click="toggleCustomerType(item)"
                class="text-xs font-semibold px-3 py-1 rounded-full border transition-colors"
                :class="item.active
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'"
              >{{ item.active ? 'Activo' : 'Inactivo' }}</button>
            </div>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-sm font-semibold text-gray-700 mb-3">Agregar tipo de cliente</p>
            <div class="flex flex-wrap gap-2 items-end">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Código</label>
                <input v-model="ctNew.code" type="text" placeholder="ej: vip" class="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Etiqueta</label>
                <input v-model="ctNew.label" type="text" placeholder="ej: VIP" class="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
              </div>
              <button
                @click="addCustomerType"
                :disabled="ctSaving || !ctNew.code || !ctNew.label"
                class="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >Agregar</button>
            </div>
            <p v-if="ctError" class="text-xs text-red-500 mt-2">{{ ctError }}</p>
          </div>
        </template>
      </div>

      <!-- ── Talles ── -->
      <div v-if="activeTab === 'sizes'">
        <div v-if="szLoading" class="space-y-2">
          <div v-for="i in 4" :key="i" class="animate-pulse bg-white rounded-xl border h-12"></div>
        </div>
        <template v-else>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div class="grid grid-cols-[1fr_auto_auto] text-xs text-gray-500 font-medium px-4 py-2 border-b border-gray-100">
              <span>Talle</span><span class="pr-6">Orden</span><span></span>
            </div>
            <div v-for="size in sizes" :key="size.id" class="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2.5 border-b border-gray-50 last:border-0">
              <span class="text-sm font-semibold text-gray-800">{{ size.label }}</span>
              <span class="text-xs text-gray-400 pr-6">{{ size.sort_order }}</span>
              <button
                @click="removeSize(size.id)"
                :disabled="szDeleting === size.id"
                class="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
              >Eliminar</button>
            </div>
            <p v-if="sizes.length === 0" class="text-center text-gray-400 text-sm py-6">Sin talles.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-sm font-semibold text-gray-700 mb-3">Agregar talle</p>
            <div class="flex flex-wrap gap-2 items-end">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Etiqueta</label>
                <input v-model="szNew.label" type="text" placeholder="ej: XXL" class="h-9 w-24 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Orden</label>
                <input v-model.number="szNew.sortOrder" type="number" min="0" class="h-9 w-20 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
              </div>
              <button
                @click="addSize"
                :disabled="szSaving || !szNew.label"
                class="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >Agregar</button>
            </div>
            <p v-if="szError" class="text-xs text-red-500 mt-2">{{ szError }}</p>
          </div>
        </template>
      </div>

      <!-- ── Colores ── -->
      <div v-if="activeTab === 'colors'">
        <div v-if="clLoading" class="space-y-2">
          <div v-for="i in 4" :key="i" class="animate-pulse bg-white rounded-xl border h-12"></div>
        </div>
        <template v-else>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div class="grid grid-cols-[auto_1fr_auto] text-xs text-gray-500 font-medium px-4 py-2 border-b border-gray-100">
              <span class="pr-3">Color</span><span>Nombre</span><span></span>
            </div>
            <div v-for="color in colors" :key="color.id" class="grid grid-cols-[auto_1fr_auto] items-center px-4 py-2.5 border-b border-gray-50 last:border-0">
              <div
                class="w-6 h-6 rounded-full border border-gray-200 mr-3 shrink-0"
                :style="color.hex_code ? { backgroundColor: color.hex_code } : {}"
              ></div>
              <span class="text-sm text-gray-800">{{ color.name }}
                <span v-if="color.hex_code" class="text-xs text-gray-400 font-mono ml-1">{{ color.hex_code }}</span>
              </span>
              <button
                @click="removeColor(color.id)"
                :disabled="clDeleting === color.id"
                class="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
              >Eliminar</button>
            </div>
            <p v-if="colors.length === 0" class="text-center text-gray-400 text-sm py-6">Sin colores.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-sm font-semibold text-gray-700 mb-3">Agregar color</p>
            <div class="flex flex-wrap gap-2 items-end">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Nombre</label>
                <input v-model="clNew.name" type="text" placeholder="ej: Turquesa" class="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Hex</label>
                <div class="flex items-center gap-1">
                  <input v-model="clNew.hexCode" type="color" class="h-9 w-10 rounded-lg border border-gray-300 p-0.5 cursor-pointer" />
                  <input v-model="clNew.hexCode" type="text" placeholder="#000000" class="h-9 w-24 rounded-lg border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                </div>
              </div>
              <button
                @click="addColor"
                :disabled="clSaving || !clNew.name"
                class="h-9 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >Agregar</button>
            </div>
            <p v-if="clError" class="text-xs text-red-500 mt-2">{{ clError }}</p>
          </div>
        </template>
      </div>

      <!-- ── Pagos ── -->
      <div v-if="activeTab === 'payments'" class="space-y-4">
        <!-- Gateway selector -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <p class="text-sm font-semibold text-gray-700 mb-4">Gateway de pago</p>
          <div class="space-y-3 max-w-sm">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Método de pago activo</label>
              <select
                v-model="paymentGateway"
                class="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                <option value="checkout_pro">Checkout Pro (redirige a Mercado Pago)</option>
                <option value="checkout_api">Checkout API (formulario embebido)</option>
                <option value="bank_transfer">Transferencia bancaria</option>
              </select>
              <p class="text-xs text-gray-400 mt-1">
                <template v-if="paymentGateway === 'checkout_api'">Checkout API requiere aprobación de MP en tu cuenta.</template>
                <template v-else-if="paymentGateway === 'bank_transfer'">Los compradores verán los datos bancarios y vos confirmás el pago manualmente.</template>
              </p>
            </div>
            <div class="flex items-center gap-3 pt-1">
              <button
                @click="savePaymentGateway"
                :disabled="gatewaySaving"
                class="h-9 px-5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >{{ gatewaySaving ? 'Guardando…' : 'Guardar' }}</button>
              <span v-if="gatewaySuccess" class="text-xs text-green-600 font-semibold">✓ Guardado</span>
              <span v-if="gatewayError" class="text-xs text-red-500">{{ gatewayError }}</span>
            </div>
          </div>
        </div>

        <!-- Datos bancarios (siempre visible para configurar de antemano) -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <p class="text-sm font-semibold text-gray-700 mb-1">Datos bancarios para transferencia</p>
          <p class="text-xs text-gray-400 mb-4">Se mostrarán al comprador cuando el gateway sea "Transferencia bancaria".</p>
          <div class="space-y-3 max-w-sm">
            <div>
              <label class="block text-xs text-gray-500 mb-1">CVU <span class="text-gray-400">(22 dígitos)</span></label>
              <input
                v-model="bankTransferForm.bankTransferCvu"
                type="text"
                maxlength="22"
                placeholder="0000000000000000000000"
                class="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Alias</label>
              <input
                v-model="bankTransferForm.bankTransferAlias"
                type="text"
                maxlength="50"
                placeholder="ej: jedami.mp"
                class="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Nombre del titular</label>
              <input
                v-model="bankTransferForm.bankTransferHolderName"
                type="text"
                maxlength="100"
                placeholder="ej: Jedami SRL"
                class="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Banco</label>
              <input
                v-model="bankTransferForm.bankTransferBankName"
                type="text"
                maxlength="100"
                placeholder="ej: Mercado Pago / Banco Nación"
                class="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Notas adicionales <span class="text-gray-400">(opcional)</span></label>
              <textarea
                v-model="bankTransferForm.bankTransferNotes"
                rows="2"
                placeholder="ej: Indicar número de pedido en el concepto"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-none"
              ></textarea>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">
                WhatsApp del negocio <span class="text-gray-400">(para recibir avisos de transferencia)</span>
              </label>
              <input
                v-model="bankTransferForm.whatsappNumber"
                type="text"
                maxlength="20"
                placeholder="ej: 5491112345678"
                class="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <p class="text-xs text-gray-400 mt-0.5">Sin + ni espacios. Código de país incluido (54 para Argentina).</p>
            </div>
            <div class="flex items-center gap-3 pt-1">
              <button
                @click="saveBankTransfer"
                :disabled="bankTransferSaving"
                class="h-9 px-5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >{{ bankTransferSaving ? 'Guardando…' : 'Guardar datos bancarios' }}</button>
              <span v-if="bankTransferSuccess" class="text-xs text-green-600 font-semibold">✓ Guardado</span>
              <span v-if="bankTransferError" class="text-xs text-red-500">{{ bankTransferError }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Branding ── -->
      <div v-if="activeTab === 'branding'">
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <p class="text-sm font-semibold text-gray-700 mb-4">Branding de la tienda</p>
          <div class="space-y-4 max-w-sm">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Nombre de la tienda</label>
              <input
                v-model="brandingForm.storeName"
                type="text"
                class="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div class="flex gap-4">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Color primario</label>
                <div class="flex items-center gap-1">
                  <input v-model="brandingForm.primaryColor" type="color" class="h-9 w-10 rounded-lg border border-gray-300 p-0.5 cursor-pointer" />
                  <input v-model="brandingForm.primaryColor" type="text" class="h-9 w-24 rounded-lg border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Color secundario</label>
                <div class="flex items-center gap-1">
                  <input v-model="brandingForm.secondaryColor" type="color" class="h-9 w-10 rounded-lg border border-gray-300 p-0.5 cursor-pointer" />
                  <input v-model="brandingForm.secondaryColor" type="text" class="h-9 w-24 rounded-lg border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
                </div>
              </div>
            </div>
            <!-- Logo -->
            <div>
              <label class="block text-xs text-gray-500 mb-2">Logo <span class="text-gray-400">(opcional)</span></label>
              <!-- Preview actual -->
              <div v-if="brandingForm.logoUrl" class="mb-2 flex items-center gap-3">
                <img :src="brandingForm.logoUrl" alt="Logo actual" class="h-12 w-auto rounded border border-gray-200 bg-gray-50 p-1" />
                <button
                  @click="brandingForm.logoUrl = null; saveBranding()"
                  class="text-xs text-red-500 hover:text-red-700"
                >Quitar logo</button>
              </div>
              <!-- Upload -->
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <span
                  class="h-9 px-4 rounded-lg border border-gray-300 text-sm text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors inline-flex items-center gap-2"
                  :class="logoUploading ? 'opacity-50 pointer-events-none' : ''"
                >
                  <svg v-if="!logoUploading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                  </svg>
                  <svg v-else class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {{ logoUploading ? 'Subiendo…' : 'Subir imagen' }}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="hidden"
                  :disabled="logoUploading"
                  @change="handleLogoUpload"
                />
              </label>
              <p v-if="logoError" class="text-xs text-red-500 mt-1">{{ logoError }}</p>
              <p class="text-xs text-gray-400 mt-1">JPG, PNG, WebP o GIF · máx. 5 MB</p>
            </div>
            <div class="flex items-center gap-3 pt-2">
              <button
                @click="saveBranding"
                :disabled="brandingSaving"
                class="h-9 px-5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >{{ brandingSaving ? 'Guardando…' : 'Guardar' }}</button>
              <span v-if="brandingSuccess" class="text-xs text-green-600 font-semibold">✓ Branding actualizado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
