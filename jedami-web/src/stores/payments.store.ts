import { defineStore } from 'pinia'
import { ref } from 'vue'
import { initiateCheckout } from '@/api/payments.api'

export const usePaymentsStore = defineStore('payments', () => {
  const loading = ref(false)
  const processingOrderId = ref<number | null>(null)
  const error = ref<string | null>(null)

  async function startCheckout(orderId: number) {
    loading.value = true
    processingOrderId.value = orderId
    error.value = null
    try {
      const result = await initiateCheckout(orderId)
      // Redirigir al checkout de Mercado Pago (checkout_pro)
      if (result.type === 'redirect') {
        window.location.href = result.checkoutUrl
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      error.value = e.response?.data?.detail ?? 'Error al iniciar el pago'
      throw err
    } finally {
      loading.value = false
      processingOrderId.value = null
    }
  }

  return { loading, processingOrderId, error, startCheckout }
})
