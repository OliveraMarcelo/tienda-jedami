import { defineStore } from 'pinia'
import { ref } from 'vue'
import { initiateCheckout, smartCheckout, type BankDetails, type SmartCheckoutResult } from '@/api/payments.api'

export const usePaymentsStore = defineStore('payments', () => {
  const loading = ref(false)
  const processingOrderId = ref<number | null>(null)
  const error = ref<string | null>(null)

  // Smart checkout state
  const pendingSelection = ref(false)
  const availableGateways = ref<string[]>([])
  const pendingOrderId = ref<number | null>(null)
  const bankDetails = ref<BankDetails | null>(null)
  const checkoutPublicKey = ref<string | null>(null)
  // Link de Checkout Pro: se muestra como QR en lugar de redirigir
  const checkoutUrl = ref<string | null>(null)

  function resetCheckoutState() {
    pendingSelection.value = false
    availableGateways.value = []
    bankDetails.value = null
    checkoutPublicKey.value = null
    checkoutUrl.value = null
    error.value = null
  }

  async function startCheckout(orderId: number) {
    loading.value = true
    processingOrderId.value = orderId
    error.value = null
    try {
      const result = await initiateCheckout(orderId)
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

  async function _handleSmartResult(result: SmartCheckoutResult) {
    if (result.type === 'select') {
      pendingSelection.value = true
      availableGateways.value = result.options
    } else if (result.type === 'redirect') {
      checkoutUrl.value = result.checkoutUrl
    } else if (result.type === 'preference') {
      checkoutPublicKey.value = result.publicKey
    } else if (result.type === 'bank_transfer') {
      bankDetails.value = result.bankDetails
    }
  }

  async function initiateSmartCheckout(orderId: number) {
    loading.value = true
    pendingOrderId.value = orderId
    resetCheckoutState()
    try {
      const result = await smartCheckout(orderId)
      await _handleSmartResult(result)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      error.value = e.response?.data?.detail ?? 'Error al iniciar el pago'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Medios que se muestran juntos en la pantalla del pedido (QR + transferencia)
  const COMBINED_GATEWAYS = ['checkout_pro', 'bank_transfer']

  /**
   * Carga todos los medios de pago del pedido a la vez: Mercado Pago (QR) y transferencia
   * se muestran lado a lado; el resto de los medios activos queda en el selector.
   */
  async function loadPaymentOptions(orderId: number) {
    loading.value = true
    pendingOrderId.value = orderId
    resetCheckoutState()
    try {
      const first = await smartCheckout(orderId)
      if (first.type !== 'select') {
        await _handleSmartResult(first)
        return
      }
      const combined = first.options.filter(g => COMBINED_GATEWAYS.includes(g))
      const others = first.options.filter(g => !COMBINED_GATEWAYS.includes(g))
      if (!combined.length) {
        await _handleSmartResult(first)
        return
      }
      const results = await Promise.allSettled(combined.map(g => smartCheckout(orderId, g)))
      for (const r of results) {
        if (r.status === 'fulfilled') await _handleSmartResult(r.value)
      }
      if (results.every(r => r.status === 'rejected')) {
        error.value = 'No pudimos preparar los medios de pago. Probá de nuevo en unos minutos.'
      }
      availableGateways.value = others
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      error.value = e.response?.data?.detail ?? 'Error al iniciar el pago'
    } finally {
      loading.value = false
    }
  }

  async function selectGateway(orderId: number, gateway: string) {
    loading.value = true
    pendingSelection.value = false
    error.value = null
    try {
      const result = await smartCheckout(orderId, gateway)
      await _handleSmartResult(result)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      error.value = e.response?.data?.detail ?? 'Error al iniciar el pago'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    processingOrderId,
    error,
    pendingSelection,
    availableGateways,
    pendingOrderId,
    bankDetails,
    checkoutPublicKey,
    checkoutUrl,
    startCheckout,
    initiateSmartCheckout,
    loadPaymentOptions,
    selectGateway,
    resetCheckoutState,
  }
})
