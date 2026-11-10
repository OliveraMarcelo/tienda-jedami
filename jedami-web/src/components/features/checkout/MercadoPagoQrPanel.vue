<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { getPaymentStatus } from '@/api/payments.api'

const props = defineProps<{
  orderId: number
  checkoutUrl: string
  amount: number
}>()

const emit = defineEmits<{
  paid: []
  cancel: []
}>()

const qrDataUrl = ref<string | null>(null)
const checking = ref(false)
const rejected = ref(false)
const pollingStopped = ref(false)

// Cada 6 s durante 15 min como máximo: queda por debajo del rate limit general
const POLL_MS = 6000
const MAX_POLL_MS = 15 * 60 * 1000
let timer: ReturnType<typeof setInterval> | null = null
let startedAt = 0

async function renderQr() {
  qrDataUrl.value = await QRCode.toDataURL(props.checkoutUrl, {
    width: 520,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1F2328', light: '#FFFFFF' },
  })
}

async function check() {
  if (checking.value) return
  checking.value = true
  try {
    const { orderStatus } = await getPaymentStatus(props.orderId)
    if (orderStatus === 'paid') {
      stopPolling()
      emit('paid')
    } else {
      rejected.value = orderStatus === 'rejected'
    }
  } catch {
    // Un fallo puntual no corta el polling
  } finally {
    checking.value = false
  }
}

function startPolling() {
  stopPolling()
  pollingStopped.value = false
  startedAt = Date.now()
  timer = setInterval(() => {
    if (document.hidden) return
    if (Date.now() - startedAt > MAX_POLL_MS) {
      stopPolling()
      pollingStopped.value = true
      return
    }
    check()
  }, POLL_MS)
}

function stopPolling() {
  if (timer) clearInterval(timer)
  timer = null
}

// Al volver a la pestaña (por ejemplo, después de pagar en la app de MP) verificar enseguida
function onVisibility() {
  if (!document.hidden) check()
}

async function manualCheck() {
  await check()
  if (pollingStopped.value) startPolling()
}

onMounted(() => {
  renderQr()
  startPolling()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(() => props.checkoutUrl, renderQr)

const formatPrice = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
</script>

<template>
  <section class="mt-4 rounded-2xl border border-[#009EE3]/30 bg-white p-5 shadow-sm" aria-labelledby="mp-qr-title">
    <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <div class="shrink-0 rounded-xl border border-gray-200 bg-white p-2">
        <img
          v-if="qrDataUrl"
          :src="qrDataUrl"
          :alt="`Código QR para pagar ${formatPrice(amount)} con Mercado Pago`"
          class="h-52 w-52"
        />
        <div v-else class="h-52 w-52 animate-pulse rounded-lg bg-gray-100" />
      </div>

      <div class="flex w-full flex-col gap-3">
        <div>
          <h2 id="mp-qr-title" class="text-base font-bold text-gray-900">Pagá con Mercado Pago</h2>
          <p class="mt-0.5 text-sm text-gray-500">
            Total a pagar: <span class="font-bold text-gray-900">{{ formatPrice(amount) }}</span>
          </p>
        </div>

        <ol class="space-y-1 text-sm text-gray-600">
          <li><span class="font-semibold text-[#009EE3]">1.</span> Escaneá el QR con la cámara o con la app de Mercado Pago</li>
          <li><span class="font-semibold text-[#009EE3]">2.</span> Pagá con dinero en cuenta, débito o crédito</li>
          <li><span class="font-semibold text-[#009EE3]">3.</span> Listo: el pedido se marca como pagado solo</li>
        </ol>

        <a
          :href="checkoutUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#009EE3] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Pagar desde este dispositivo
        </a>

        <p v-if="rejected" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          El último intento de pago fue rechazado. Podés volver a intentarlo con el mismo QR.
        </p>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-live="polite">
          <span v-if="!pollingStopped" class="inline-flex items-center gap-2 text-gray-500">
            <span class="relative flex h-2.5 w-2.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#009EE3] opacity-60" />
              <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#009EE3]" />
            </span>
            Esperando el pago…
          </span>
          <button
            type="button"
            class="font-semibold text-[#009EE3] hover:underline disabled:opacity-50"
            :disabled="checking"
            @click="manualCheck"
          >
            {{ checking ? 'Verificando…' : 'Ya pagué, verificar' }}
          </button>
          <button type="button" class="text-gray-400 hover:text-gray-600" @click="emit('cancel')">
            Elegir otro medio
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
