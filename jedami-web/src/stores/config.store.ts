import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchConfig, fetchBranding, type AppConfig, type BrandingConfig, type PaymentGatewayRuleItem } from '@/api/config.api'

const DEFAULT_BRANDING: BrandingConfig = {
  storeName: 'Jedami',
  primaryColor: '#E91E8C',
  secondaryColor: '#1E1E2E',
  logoUrl: null,
  bankTransferCvu: null,
  bankTransferAlias: null,
  bankTransferHolderName: null,
  bankTransferBankName: null,
  bankTransferNotes: null,
  whatsappNumber: null,
}

export const useConfigStore = defineStore('config', () => {
  const loaded = ref(false)
  const loading = ref(false)

  const branding = ref<BrandingConfig>({ ...DEFAULT_BRANDING })

  const config = ref<AppConfig>({
    roles: [],
    priceModes: [],
    purchaseTypes: [],
    customerTypes: [],
    paymentGateway: 'checkout_pro',
    paymentGatewayRules: { retail: [], wholesale: [] },
    pointDevice: null,
  })

  // Mapas código → label para uso en templates
  const purchaseTypeLabel = computed<Record<string, string>>(() =>
    Object.fromEntries(config.value.purchaseTypes.map(pt => [pt.code, pt.label]))
  )

  const customerTypeLabel = computed<Record<string, string>>(() =>
    Object.fromEntries(config.value.customerTypes.map(ct => [ct.code, ct.label]))
  )

  const priceModeLabel = computed<Record<string, string>>(() =>
    Object.fromEntries(config.value.priceModes.map(pm => [pm.code, pm.label]))
  )

  const paymentGatewayRules = computed(() =>
    config.value.paymentGatewayRules ?? { retail: [], wholesale: [] }
  )

  const pointDevice = computed(() => config.value.pointDevice ?? null)

  function getGatewaysForCustomerType(type: 'retail' | 'wholesale'): PaymentGatewayRuleItem[] {
    return paymentGatewayRules.value[type] ?? []
  }

  async function loadConfig() {
    if (loaded.value) return
    loading.value = true
    try {
      config.value = await fetchConfig()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function refreshConfig() {
    loading.value = true
    try {
      config.value = await fetchConfig()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function loadBranding() {
    try {
      branding.value = await fetchBranding()
    } catch {
      branding.value = { ...DEFAULT_BRANDING }
    }
  }

  return {
    loaded,
    loading,
    config,
    branding,
    purchaseTypeLabel,
    customerTypeLabel,
    priceModeLabel,
    paymentGatewayRules,
    pointDevice,
    getGatewaysForCustomerType,
    loadConfig,
    refreshConfig,
    loadBranding,
  }
})
