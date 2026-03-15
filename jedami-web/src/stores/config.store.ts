import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchConfig, type AppConfig } from '@/api/config.api'

export const useConfigStore = defineStore('config', () => {
  const loaded = ref(false)
  const loading = ref(false)

  const config = ref<AppConfig>({
    roles: [],
    priceModes: [],
    purchaseTypes: [],
    customerTypes: [],
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

  return {
    loaded,
    loading,
    config,
    purchaseTypeLabel,
    customerTypeLabel,
    priceModeLabel,
    loadConfig,
  }
})
