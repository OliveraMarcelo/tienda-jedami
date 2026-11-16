<script setup lang="ts">
// Acciones de un pedido en Pagos: cancelar, confirmar transferencia y copiar el link de pago para el cliente.
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { apiErrorDetail } from '@/lib/auth-errors'
import { confirmBankTransfer, type AdminPayment } from '@/api/admin.payments.api'
import { cancelOrder } from '@/api/orders.api'
import { retryPayment } from '@/api/payments.api'

const props = defineProps<{ payment: AdminPayment }>()
const emit = defineEmits<{ changed: [patch: Partial<AdminPayment>] }>()

const p = computed(() => props.payment)
const pending = computed(() => p.value.orderStatus === 'pending')
const canConfirmTransfer = computed(() => pending.value && p.value.methods.includes('bank_transfer'))
// Link de Mercado Pago: si se le ofreció, o si todavía no inició ningún pago
const canShareLink = computed(() =>
  ['pending', 'rejected'].includes(p.value.orderStatus) && p.value.totalAmount > 0 &&
  (p.value.methods.length === 0 || p.value.methods.some(m => m !== 'bank_transfer')),
)

const busy = ref<'' | 'cancel' | 'confirm' | 'link'>('')
const askingCancel = ref(false)
const error = ref('')
const linkCopied = ref(false)

async function run(kind: 'cancel' | 'confirm' | 'link', fn: () => Promise<void>, fallback: string) {
  busy.value = kind
  error.value = ''
  try {
    await fn()
  } catch (e: unknown) {
    error.value = apiErrorDetail(e, fallback)
  } finally {
    busy.value = ''
  }
}

const doCancel = () => run('cancel', async () => {
  await cancelOrder(p.value.orderId)
  askingCancel.value = false
  emit('changed', { orderStatus: 'cancelled' })
}, 'Error al cancelar')

const doConfirm = () => run('confirm', async () => {
  await confirmBankTransfer(p.value.orderId)
  emit('changed', { orderStatus: 'paid', paymentStatus: 'approved', paymentMethod: 'bank_transfer' })
}, 'Error al confirmar')

// Genera (o reutiliza) el link de Mercado Pago y lo copia para mandárselo al cliente
const doLink = () => run('link', async () => {
  const { checkoutUrl } = await retryPayment(p.value.orderId)
  await navigator.clipboard.writeText(checkoutUrl)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2500)
}, 'Error al generar el link')
</script>

<template>
  <div class="flex flex-wrap gap-x-3 gap-y-1.5 items-center text-xs font-semibold">
    <RouterLink v-if="payment.orderStatus === 'paid'" to="/admin/despacho" class="text-[var(--a-primary)] hover:underline">
      Ir a despacho →
    </RouterLink>

    <button
      v-if="canConfirmTransfer"
      type="button"
      :disabled="busy !== ''"
      class="text-indigo-600 hover:opacity-80 disabled:opacity-40"
      @click="doConfirm"
    >{{ busy === 'confirm' ? 'Confirmando…' : 'Confirmar transferencia' }}</button>

    <button
      v-if="canShareLink"
      type="button"
      :disabled="busy !== ''"
      class="text-[#009EE3] hover:opacity-80 disabled:opacity-40"
      title="Copia el link de Mercado Pago para mandárselo al cliente"
      @click="doLink"
    >{{ busy === 'link' ? 'Generando…' : linkCopied ? '✓ Link copiado' : 'Copiar link de pago' }}</button>

    <template v-if="pending">
      <button
        v-if="!askingCancel"
        type="button"
        class="text-red-500 hover:text-red-700"
        @click="askingCancel = true; error = ''"
      >Cancelar pedido</button>
      <span v-else class="inline-flex items-center gap-2">
        <span class="font-normal text-[var(--a-muted)]">¿Cancelar?</span>
        <button type="button" :disabled="busy !== ''" class="text-red-600 hover:underline" @click="doCancel">Sí</button>
        <button type="button" class="font-normal text-[var(--a-muted)] hover:underline" @click="askingCancel = false">No</button>
      </span>
    </template>

    <p v-if="error" role="alert" class="basis-full font-normal text-red-500">{{ error }}</p>
  </div>
</template>
