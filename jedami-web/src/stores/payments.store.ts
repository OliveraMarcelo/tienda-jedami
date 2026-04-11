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

  function resetCheckoutState() {
    pendingSelection.value = false
    availableGateways.value = []
    bankDetails.value = null
    checkoutPublicKey.value = null
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
      window.location.href = result.checkoutUrl
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
    startCheckout,
    initiateSmartCheckout,
    selectGateway,
    resetCheckoutState,
  }
})
