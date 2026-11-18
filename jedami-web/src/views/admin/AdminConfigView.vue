<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { AxiosError } from 'axios'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { useConfigStore } from '@/stores/config.store'
import {
  fetchSizes, createSize, deleteSize,
  fetchColors, createColor, deleteColor,
  updateBranding, uploadBrandingLogo, updatePaymentGateway,
  fetchPaymentGatewayRules, patchPaymentGatewayRule,
  type SizeItem, type ColorItem, type PaymentGatewayRulesMap,
} from '@/api/admin.config.api'
import type { BrandingConfig } from '@/api/config.api'
import { GATEWAY_LABELS, ALL_GATEWAYS, type SupportedGateway } from '@/lib/gateway-labels'
import { fetchPosDevices, syncPosDevices, updatePosDevice, type PosDevice } from '@/api/pos.api'

type PosApiError = AxiosError<{ detail?: string }>
type ConfigApiError = AxiosError<{ detail?: string }>

const configStore = useConfigStore()

type Tab = 'catalog' | 'branding' | 'payments' | 'point'
const activeTab = ref<Tab>('branding')

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
  } catch (err) {
    const e = err as ConfigApiError
    szError.value = e?.response?.data?.detail ?? 'Error al guardar.'
  } finally { szSaving.value = false }
}

async function removeSize(id: number) {
  szDeleting.value = id
  szError.value = ''
  try {
    await deleteSize(id)
    sizes.value = sizes.value.filter(s => s.id !== id)
  } catch (err) {
    const e = err as ConfigApiError
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
  } catch (err) {
    const e = err as ConfigApiError
    clError.value = e?.response?.data?.detail ?? 'Error al guardar.'
  } finally { clSaving.value = false }
}

async function removeColor(id: number) {
  clDeleting.value = id
  clError.value = ''
  try {
    await deleteColor(id)
    colors.value = colors.value.filter(c => c.id !== id)
  } catch (err) {
    const e = err as ConfigApiError
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
  configStore.branding.whatsappNumber = updated.whatsappNumber
  configStore.branding.locationName = updated.locationName ?? null
  configStore.branding.locationStall = updated.locationStall ?? null
  configStore.branding.locationAisle = updated.locationAisle ?? null
  configStore.branding.locationMapsUrl = updated.locationMapsUrl ?? null
  brandingForm.value.logoUrl = updated.logoUrl
}

const brandingError = ref('')

async function saveBranding() {
  brandingSaving.value = true
  brandingSuccess.value = false
  brandingError.value = ''
  try {
    const f = brandingForm.value
    // Solo lo de esta pestaña: los datos bancarios se guardan en Medios de pago
    const updated = await updateBranding({
      storeName: f.storeName,
      primaryColor: f.primaryColor,
      secondaryColor: f.secondaryColor,
      logoUrl: f.logoUrl,
      whatsappNumber: f.whatsappNumber?.replace(/\D/g, '') || null,
      locationName: f.locationName?.trim() || null,
      locationStall: f.locationStall?.trim() || null,
      locationAisle: f.locationAisle?.trim() || null,
      locationMapsUrl: f.locationMapsUrl?.trim() || null,
    })
    applyBrandingToStore(updated)
    brandingSuccess.value = true
    setTimeout(() => { brandingSuccess.value = false }, 2500)
  } catch (err) {
    const e = err as ConfigApiError
    brandingError.value = e?.response?.data?.detail ?? 'No se pudo guardar'
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
  } catch (err) {
    const e = err as ConfigApiError
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
    })
    configStore.branding.bankTransferCvu        = updated.bankTransferCvu
    configStore.branding.bankTransferAlias      = updated.bankTransferAlias
    configStore.branding.bankTransferHolderName = updated.bankTransferHolderName
    configStore.branding.bankTransferBankName   = updated.bankTransferBankName
    configStore.branding.bankTransferNotes      = updated.bankTransferNotes
    bankTransferSuccess.value = true
    setTimeout(() => { bankTransferSuccess.value = false }, 2500)
  } catch (err) {
    const e = err as ConfigApiError
    bankTransferError.value = e?.response?.data?.detail ?? 'Error al guardar'
  } finally {
    bankTransferSaving.value = false
  }
}

// ─── Payment Gateway Rules ────────────────────────────────────────────────────
const pgRules = ref<PaymentGatewayRulesMap>({ retail: [], wholesale: [] })
const pgRulesLoading = ref(false)
const pgRulesUpdating = ref<string | null>(null)
const pgRulesError = ref('')
const pgRulesSuccess = ref('')

async function loadPaymentGatewayRules() {
  pgRulesLoading.value = true
  try { pgRules.value = await fetchPaymentGatewayRules() }
  catch { pgRulesError.value = 'Error al cargar los medios de pago' }
  finally { pgRulesLoading.value = false }
}

function isGatewayActive(customerType: 'retail' | 'wholesale', gateway: string): boolean {
  const rules = pgRules.value[customerType] ?? []
  const rule = rules.find(r => r.gateway === gateway)
  return rule?.active ?? false
}

async function toggleGatewayRule(customerType: 'retail' | 'wholesale', gateway: string) {
  const key = `${customerType}:${gateway}`
  pgRulesUpdating.value = key
  pgRulesError.value = ''
  pgRulesSuccess.value = ''
  try {
    const newActive = !isGatewayActive(customerType, gateway)
    const updated = await patchPaymentGatewayRule(customerType, gateway, newActive)
    const rules = pgRules.value[customerType]
    const idx = rules.findIndex(r => r.gateway === gateway)
    if (idx !== -1) {
      rules[idx] = updated
    } else {
      rules.push(updated)
    }
    pgRulesSuccess.value = `${GATEWAY_LABELS[gateway as SupportedGateway]?.label ?? gateway} actualizado`
    setTimeout(() => { pgRulesSuccess.value = '' }, 2500)
  } catch (err) {
    const e = err as ConfigApiError
    pgRulesError.value = e?.response?.data?.detail ?? 'Error al actualizar'
  } finally {
    pgRulesUpdating.value = null
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// ─── Dispositivos Point ───────────────────────────────────────────────────────
const posDevices = ref<PosDevice[]>([])
const posDevicesLoading = ref(false)
const posDevicesError = ref('')
const syncingDevices = ref(false)
const syncSuccess = ref('')

async function loadPosDevices() {
  posDevicesLoading.value = true
  posDevicesError.value = ''
  try { posDevices.value = await fetchPosDevices() }
  catch { posDevicesError.value = 'Error al cargar los dispositivos.' }
  finally { posDevicesLoading.value = false }
}

async function handleSyncDevices() {
  syncingDevices.value = true
  syncSuccess.value = ''
  posDevicesError.value = ''
  try {
    posDevices.value = await syncPosDevices()
    syncSuccess.value = `${posDevices.value.length} dispositivo(s) sincronizados`
    await configStore.refreshConfig()
  } catch (err) {
    const e = err as PosApiError
    posDevicesError.value = e?.response?.data?.detail ?? 'Error al sincronizar'
  } finally {
    syncingDevices.value = false
  }
}

async function togglePosDevice(device: PosDevice) {
  posDevicesError.value = ''
  syncSuccess.value = ''
  try {
    const updated = await updatePosDevice(device.id, !device.active)
    const idx = posDevices.value.findIndex(d => d.id === device.id)
    if (idx !== -1) posDevices.value[idx] = updated
    await configStore.refreshConfig()
  } catch (err) {
    const e = err as PosApiError
    posDevicesError.value = e?.response?.data?.detail ?? 'Error al actualizar el dispositivo'
  }
}

onMounted(async () => {
  await Promise.all([loadSizes(), loadColors(), loadPaymentGatewayRules(), loadPosDevices()])
  brandingForm.value = { ...configStore.branding }
})

// "Cobros Point" (Mercado Pago Point) oculto hasta tener el dispositivo
const TABS: { key: Tab; label: string }[] = [
  { key: 'branding', label: 'Marca y contacto' },
  { key: 'payments', label: 'Medios de pago' },
  { key: 'catalog',  label: 'Talles y colores' },
]
</script>

<template>
  <AdminLayout title="Configuración">
    <div>
      <!-- Pestañas -->
      <div class="mb-4 border-b border-[var(--a-border)]">
        <nav class="-mb-px flex gap-1 overflow-x-auto">
          <button
            v-for="tab in TABS"
            :key="tab.key"
            type="button"
            class="whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
            :class="activeTab === tab.key
              ? 'border-[var(--a-primary)] text-[var(--a-primary)]'
              : 'border-transparent text-[var(--a-muted)] hover:border-[#C9CDD2] hover:text-[#45494E]'"
            @click="activeTab = tab.key"
          >{{ tab.label }}</button>
        </nav>
      </div>

      <Transition name="jd-fade" mode="out-in">
      <!-- ── Marca y contacto ── -->
      <div v-if="activeTab === 'branding'" key="branding" class="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section class="rounded-xl border border-[var(--a-border)] bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-[#45494E]">Marca</h2>
          <div class="space-y-4">
            <div>
              <label for="b-name" class="mb-1 block text-xs text-[var(--a-muted)]">Nombre de la tienda</label>
              <input id="b-name" v-model="brandingForm.storeName" type="text" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-1 block text-xs text-[var(--a-muted)]">Color principal</label>
                <div class="flex items-center gap-1">
                  <input v-model="brandingForm.primaryColor" type="color" aria-label="Elegir color principal" class="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-[#C9CDD2] p-0.5" />
                  <input v-model="brandingForm.primaryColor" type="text" aria-label="Color principal" class="h-10 w-full min-w-0 rounded-lg border border-[#C9CDD2] px-3 font-mono text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-xs text-[var(--a-muted)]">Color secundario</label>
                <div class="flex items-center gap-1">
                  <input v-model="brandingForm.secondaryColor" type="color" aria-label="Elegir color secundario" class="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-[#C9CDD2] p-0.5" />
                  <input v-model="brandingForm.secondaryColor" type="text" aria-label="Color secundario" class="h-10 w-full min-w-0 rounded-lg border border-[#C9CDD2] px-3 font-mono text-sm focus:outline-none" />
                </div>
              </div>
            </div>
            <div>
              <span class="mb-1 block text-xs text-[var(--a-muted)]">Logo <span class="text-[var(--a-muted)]">(opcional)</span></span>
              <div class="flex flex-wrap items-center gap-3">
                <img v-if="brandingForm.logoUrl" :src="brandingForm.logoUrl" alt="Logo actual" class="h-12 w-auto rounded border border-[var(--a-border)] bg-[var(--a-bg)] p-1" />
                <label class="inline-flex cursor-pointer items-center gap-2">
                  <span
                    class="inline-flex h-10 items-center gap-2 rounded-lg border border-[#C9CDD2] px-4 text-sm text-[var(--a-muted)] transition-colors hover:border-[var(--a-primary)] hover:text-[var(--a-primary)]"
                    :class="logoUploading ? 'pointer-events-none opacity-50' : ''"
                  >
                    <svg v-if="!logoUploading" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    <svg v-else class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    {{ logoUploading ? 'Subiendo…' : brandingForm.logoUrl ? 'Cambiar logo' : 'Subir logo' }}
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" :disabled="logoUploading" @change="handleLogoUpload" />
                </label>
                <button v-if="brandingForm.logoUrl" type="button" class="text-xs text-red-500 hover:text-red-700" @click="brandingForm.logoUrl = null; saveBranding()">Quitar logo</button>
              </div>
              <p v-if="logoError" class="mt-1 text-xs text-red-500">{{ logoError }}</p>
              <p class="mt-1 text-xs text-[var(--a-muted)]">JPG, PNG, WebP o GIF · máx. 5 MB</p>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-[var(--a-border)] bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-[#45494E]">Contacto y local</h2>
          <div class="space-y-4">
            <div>
              <label for="b-wa" class="mb-1 block text-xs text-[var(--a-muted)]">WhatsApp del negocio</label>
              <input id="b-wa" v-model="brandingForm.whatsappNumber" type="tel" inputmode="numeric" maxlength="20" placeholder="ej: 5491112345678" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
              <p class="mt-1 text-xs text-[var(--a-muted)]">Con el 54 adelante, sin + ni espacios. Ahí te escriben los clientes.</p>
            </div>
            <div>
              <label for="b-loc" class="mb-1 block text-xs text-[var(--a-muted)]">Local (galería o feria)</label>
              <input id="b-loc" v-model="brandingForm.locationName" type="text" maxlength="120" placeholder="ej: Quivincha, La Salada" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="b-stall" class="mb-1 block text-xs text-[var(--a-muted)]">Puesto</label>
                <input id="b-stall" v-model="brandingForm.locationStall" type="text" maxlength="40" placeholder="ej: 125" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
              </div>
              <div>
                <label for="b-aisle" class="mb-1 block text-xs text-[var(--a-muted)]">Pasillo</label>
                <input id="b-aisle" v-model="brandingForm.locationAisle" type="text" maxlength="40" placeholder="ej: 4" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
              </div>
            </div>
            <div>
              <label for="b-maps" class="mb-1 block text-xs text-[var(--a-muted)]">Link de Google Maps <span class="text-[var(--a-muted)]">(opcional)</span></label>
              <input id="b-maps" v-model="brandingForm.locationMapsUrl" type="url" maxlength="500" placeholder="https://maps.app.goo.gl/…" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
            </div>
            <p class="text-xs text-[var(--a-muted)]">Se muestra al pie de la tienda, en “Nuestro local”.</p>
          </div>
        </section>

        <div class="flex items-center gap-3 lg:col-span-2">
          <button type="button" :disabled="brandingSaving" class="h-10 px-5 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none" @click="saveBranding">{{ brandingSaving ? 'Guardando…' : 'Guardar cambios' }}</button>
          <Transition name="jd-fade"><span v-if="brandingSuccess" class="text-xs font-semibold text-green-600">✓ Guardado</span></Transition>
          <span v-if="brandingError" class="text-xs text-red-500">{{ brandingError }}</span>
        </div>
      </div>

      <!-- ── Medios de pago ── -->
      <div v-else-if="activeTab === 'payments'" key="payments" class="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div class="space-y-4">
          <!-- Medios de pago por tipo de cliente -->
          <section class="rounded-xl border border-[var(--a-border)] bg-white p-5">
            <h2 class="text-sm font-semibold text-[#45494E]">Medios de pago por tipo de cliente</h2>
            <p class="mb-3 text-xs text-[var(--a-muted)]">Qué puede usar cada cliente al pagar.</p>

            <div v-if="pgRulesLoading" class="space-y-2">
              <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100"></div>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-[var(--a-border)]">
                    <th class="py-2 pr-4 text-left">Medio</th>
                    <th class="px-3 py-2 text-center">Minorista</th>
                    <th class="px-3 py-2 text-center">Mayorista</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="gw in ALL_GATEWAYS" :key="gw" class="border-t border-[var(--a-border)]">
                    <td class="py-2.5 pr-4 font-semibold text-[var(--a-ink)]">{{ GATEWAY_LABELS[gw].label }}</td>
                    <td class="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        :disabled="pgRulesUpdating === `retail:${gw}`"
                        class="text-xs font-semibold px-3 py-1 rounded-full border transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        :class="isGatewayActive('retail', gw)
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                        : 'bg-[var(--a-bg)] text-[var(--a-muted)] border-[var(--a-border)] hover:bg-green-50 hover:text-green-700 hover:border-green-200'"
                        @click="toggleGatewayRule('retail', gw)"
                      >{{ pgRulesUpdating === `retail:${gw}` ? '…' : (isGatewayActive('retail', gw) ? 'Activo' : 'Inactivo') }}</button>
                    </td>
                    <td class="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        :disabled="pgRulesUpdating === `wholesale:${gw}`"
                        class="text-xs font-semibold px-3 py-1 rounded-full border transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        :class="isGatewayActive('wholesale', gw)
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                        : 'bg-[var(--a-bg)] text-[var(--a-muted)] border-[var(--a-border)] hover:bg-green-50 hover:text-green-700 hover:border-green-200'"
                        @click="toggleGatewayRule('wholesale', gw)"
                      >{{ pgRulesUpdating === `wholesale:${gw}` ? '…' : (isGatewayActive('wholesale', gw) ? 'Activo' : 'Inactivo') }}</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mt-2 h-4">
              <span v-if="pgRulesSuccess" class="text-xs font-semibold text-green-600">✓ {{ pgRulesSuccess }}</span>
              <span v-if="pgRulesError" class="text-xs text-red-500">{{ pgRulesError }}</span>
            </div>
          </section>

          <!-- Pasarela -->
          <section class="rounded-xl border border-[var(--a-border)] bg-white p-5">
            <h2 class="text-sm font-semibold text-[#45494E]">Pasarela de pago</h2>
            <p class="mb-3 text-xs text-[var(--a-muted)]">La que se usa por defecto.</p>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div class="flex-1">
                <label for="pg" class="sr-only">Método de pago activo</label>
                <select id="pg" v-model="paymentGateway" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none">
                  <option value="checkout_pro">Checkout Pro (redirige a Mercado Pago)</option>
                  <option value="checkout_api">Checkout API (formulario embebido)</option>
                  <option value="bank_transfer">Transferencia bancaria</option>
                </select>
                <p v-if="paymentGateway !== 'checkout_pro'" class="mt-1 text-xs text-[var(--a-muted)]">
                  <template v-if="paymentGateway === 'checkout_api'">Checkout API requiere aprobación de MP en tu cuenta.</template>
                  <template v-else>Los compradores ven los datos bancarios y vos confirmás el pago.</template>
                </p>
              </div>
              <button type="button" :disabled="gatewaySaving" class="h-10 px-5 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none" @click="savePaymentGateway">{{ gatewaySaving ? 'Guardando…' : 'Guardar' }}</button>
            </div>
            <div class="mt-2 h-4">
              <span v-if="gatewaySuccess" class="text-xs font-semibold text-green-600">✓ Guardado</span>
              <span v-if="gatewayError" class="text-xs text-red-500">{{ gatewayError }}</span>
            </div>
          </section>
        </div>

        <!-- Datos bancarios -->
        <section class="rounded-xl border border-[var(--a-border)] bg-white p-5">
          <h2 class="text-sm font-semibold text-[#45494E]">Datos para transferencia</h2>
          <p class="mb-4 text-xs text-[var(--a-muted)]">Los ve el cliente cuando elige pagar por transferencia: revisalos bien.</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label for="bt-cvu" class="mb-1 block text-xs text-[var(--a-muted)]">CVU <span class="text-[var(--a-muted)]">(22 dígitos)</span></label>
              <input id="bt-cvu" v-model="bankTransferForm.bankTransferCvu" type="text" inputmode="numeric" maxlength="22" placeholder="0000000000000000000000" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none font-mono" />
            </div>
            <div>
              <label for="bt-alias" class="mb-1 block text-xs text-[var(--a-muted)]">Alias</label>
              <input id="bt-alias" v-model="bankTransferForm.bankTransferAlias" type="text" maxlength="50" placeholder="ej: jedami.mp" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
            </div>
            <div>
              <label for="bt-bank" class="mb-1 block text-xs text-[var(--a-muted)]">Banco</label>
              <input id="bt-bank" v-model="bankTransferForm.bankTransferBankName" type="text" maxlength="100" placeholder="ej: Mercado Pago" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
            </div>
            <div class="sm:col-span-2">
              <label for="bt-holder" class="mb-1 block text-xs text-[var(--a-muted)]">Nombre del titular</label>
              <input id="bt-holder" v-model="bankTransferForm.bankTransferHolderName" type="text" maxlength="100" placeholder="ej: Jedami SRL" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
            </div>
            <div class="sm:col-span-2">
              <label for="bt-notes" class="mb-1 block text-xs text-[var(--a-muted)]">Notas <span class="text-[var(--a-muted)]">(opcional)</span></label>
              <textarea id="bt-notes" v-model="bankTransferForm.bankTransferNotes" rows="2" placeholder="ej: Indicar número de pedido en el concepto" class="w-full resize-none rounded-lg border border-[#C9CDD2] px-3 py-2 text-sm focus:outline-none"></textarea>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-3">
            <button type="button" :disabled="bankTransferSaving" class="h-10 px-5 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none" @click="saveBankTransfer">{{ bankTransferSaving ? 'Guardando…' : 'Guardar datos' }}</button>
            <Transition name="jd-fade"><span v-if="bankTransferSuccess" class="text-xs font-semibold text-green-600">✓ Guardado</span></Transition>
            <span v-if="bankTransferError" class="text-xs text-red-500">{{ bankTransferError }}</span>
          </div>
        </section>
      </div>

      <!-- ── Talles y colores ── -->
      <div v-else-if="activeTab === 'catalog'" key="catalog" class="grid gap-4 lg:grid-cols-2 lg:items-start">
        <!-- Talles -->
        <section class="overflow-hidden rounded-xl border border-[var(--a-border)] bg-white">
          <header class="border-b border-[var(--a-border)] px-5 py-4">
            <h2 class="text-sm font-semibold text-[#45494E]">Talles</h2>
            <p class="text-xs text-[var(--a-muted)]">El orden es el que se ve en la tienda y en Despacho.</p>
          </header>
          <div v-if="szLoading" class="space-y-2 p-4">
            <div v-for="i in 4" :key="i" class="h-9 animate-pulse rounded-lg bg-[var(--a-bg)]"></div>
          </div>
          <template v-else>
            <ul class="max-h-[360px] divide-y divide-[var(--a-border)] overflow-y-auto">
              <li v-for="size in sizes" :key="size.id" class="flex items-center gap-3 px-5 py-2.5">
                <span class="w-8 text-xs tabular-nums text-[var(--a-muted)]" title="Orden">{{ size.sort_order }}</span>
                <span class="flex-1 text-sm font-semibold text-[var(--a-ink)]">{{ size.label }}</span>
                <button type="button" :disabled="szDeleting === size.id" class="text-xs text-red-500 hover:text-red-700 disabled:opacity-40" @click="removeSize(size.id)">Eliminar</button>
              </li>
              <li v-if="sizes.length === 0" class="py-6 text-center text-sm text-[var(--a-muted)]">Sin talles.</li>
            </ul>
            <form class="flex flex-wrap items-end gap-2 border-t border-[var(--a-border)] bg-[#FAFBFC] px-5 py-4" @submit.prevent="addSize">
              <div class="flex-1">
                <label for="sz-label" class="mb-1 block text-xs text-[var(--a-muted)]">Nuevo talle</label>
                <input id="sz-label" v-model="szNew.label" type="text" placeholder="ej: XXL" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
              </div>
              <div class="w-20">
                <label for="sz-order" class="mb-1 block text-xs text-[var(--a-muted)]">Orden</label>
                <input id="sz-order" v-model.number="szNew.sortOrder" type="number" min="0" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
              </div>
              <button type="submit" :disabled="szSaving || !szNew.label" class="h-10 px-5 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none">Agregar</button>
              <p v-if="szError" class="w-full text-xs text-red-500">{{ szError }}</p>
            </form>
          </template>
        </section>

        <!-- Colores -->
        <section class="overflow-hidden rounded-xl border border-[var(--a-border)] bg-white">
          <header class="border-b border-[var(--a-border)] px-5 py-4">
            <h2 class="text-sm font-semibold text-[#45494E]">Colores</h2>
            <p class="text-xs text-[var(--a-muted)]">Creá el color antes de cargarlo en un producto.</p>
          </header>
          <div v-if="clLoading" class="space-y-2 p-4">
            <div v-for="i in 4" :key="i" class="h-9 animate-pulse rounded-lg bg-[var(--a-bg)]"></div>
          </div>
          <template v-else>
            <ul class="max-h-[360px] divide-y divide-[var(--a-border)] overflow-y-auto">
              <li v-for="color in colors" :key="color.id" class="flex items-center gap-3 px-5 py-2.5">
                <span class="h-6 w-6 shrink-0 rounded-full border border-[var(--a-border)]" :style="color.hex_code ? { backgroundColor: color.hex_code } : {}"></span>
                <span class="flex-1 text-sm text-[var(--a-ink)]">{{ color.name }}
                  <span v-if="color.hex_code" class="ml-1 font-mono text-xs text-[var(--a-muted)]">{{ color.hex_code }}</span>
                </span>
                <button type="button" :disabled="clDeleting === color.id" class="text-xs text-red-500 hover:text-red-700 disabled:opacity-40" @click="removeColor(color.id)">Eliminar</button>
              </li>
              <li v-if="colors.length === 0" class="py-6 text-center text-sm text-[var(--a-muted)]">Sin colores.</li>
            </ul>
            <form class="flex flex-wrap items-end gap-2 border-t border-[var(--a-border)] bg-[#FAFBFC] px-5 py-4" @submit.prevent="addColor">
              <div class="min-w-[140px] flex-1">
                <label for="cl-name" class="mb-1 block text-xs text-[var(--a-muted)]">Nuevo color</label>
                <input id="cl-name" v-model="clNew.name" type="text" placeholder="ej: Turquesa" class="h-10 w-full rounded-lg border border-[#C9CDD2] px-3 text-sm focus:outline-none" />
              </div>
              <div>
                <label for="cl-hex" class="mb-1 block text-xs text-[var(--a-muted)]">Tono</label>
                <div class="flex items-center gap-1">
                  <input v-model="clNew.hexCode" type="color" aria-label="Elegir tono" class="h-10 w-10 cursor-pointer rounded-lg border border-[#C9CDD2] p-0.5" />
                  <input id="cl-hex" v-model="clNew.hexCode" type="text" placeholder="#000000" class="h-10 w-24 rounded-lg border border-[#C9CDD2] px-3 font-mono text-sm focus:outline-none" />
                </div>
              </div>
              <button type="submit" :disabled="clSaving || !clNew.name" class="h-10 px-5 rounded-lg bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none">Agregar</button>
              <p v-if="clError" class="w-full text-xs text-red-500">{{ clError }}</p>
            </form>
          </template>
        </section>
      </div>

      <!-- ── Point POS ── -->
      <div v-else-if="activeTab === 'point'" key="point">
        <div class="bg-white rounded-xl border border-[var(--a-border)] p-5">
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm font-semibold text-[#45494E]">Dispositivos Mercado Pago Point</p>
            <button
              @click="handleSyncDevices"
              :disabled="syncingDevices"
              class="h-8 px-4 rounded-lg border border-[#C9CDD2] text-sm text-[var(--a-muted)] hover:border-[var(--a-primary)] hover:text-[var(--a-primary)] transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
            >
              <svg v-if="syncingDevices" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {{ syncingDevices ? 'Sincronizando…' : '↻ Sincronizar con MP' }}
            </button>
          </div>

          <div v-if="posDevicesLoading" class="space-y-2">
            <div v-for="i in 2" :key="i" class="animate-pulse bg-gray-100 rounded-xl h-12"></div>
          </div>

          <div v-else-if="posDevices.length === 0" class="text-center text-sm text-[var(--a-muted)] py-6">
            No hay dispositivos registrados. Hacé clic en "Sincronizar con MP" para importarlos.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="device in posDevices"
              :key="device.id"
              class="flex items-center justify-between px-4 py-3 border border-[var(--a-border)] rounded-xl"
            >
              <div>
                <p class="font-semibold text-[var(--a-ink)] text-sm">{{ device.name }}</p>
                <p class="text-xs text-[var(--a-muted)] font-mono">{{ device.mp_device_id }} · {{ device.operating_mode }}</p>
              </div>
              <button
                @click="togglePosDevice(device)"
                class="text-xs font-semibold px-3 py-1 rounded-full border transition-colors"
                :class="device.active
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                  : 'bg-[var(--a-bg)] text-[var(--a-muted)] border-[var(--a-border)] hover:bg-green-50 hover:text-green-700 hover:border-green-200'"
              >{{ device.active ? 'Activo' : 'Inactivo' }}</button>
            </div>
          </div>

          <div class="mt-3 h-4">
            <span v-if="syncSuccess" class="text-xs text-green-600 font-semibold">✓ {{ syncSuccess }}</span>
            <span v-if="posDevicesError" class="text-xs text-red-500">{{ posDevicesError }}</span>
          </div>
        </div>
      </div>
      </Transition>
    </div>
  </AdminLayout>
</template>
