<script setup lang="ts">
import { GATEWAY_LABELS, type SupportedGateway } from '@/lib/gateway-labels'

defineProps<{
  gateways: string[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'gateway-selected': [gateway: string]
}>()

function getLabel(gateway: string): string {
  return GATEWAY_LABELS[gateway as SupportedGateway]?.label ?? gateway
}

function getDescription(gateway: string): string {
  return GATEWAY_LABELS[gateway as SupportedGateway]?.description ?? ''
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm font-semibold text-gray-700 mb-2">Elegí cómo querés pagar</p>
    <button
      v-for="gw in gateways"
      :key="gw"
      :disabled="loading"
      @click="emit('gateway-selected', gw)"
      class="w-full flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-[var(--color-primary)] hover:bg-pink-50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
    >
      <!-- Ícono por gateway -->
      <span class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100">
        <!-- checkout_pro: ícono MP -->
        <template v-if="gw === 'checkout_pro'">
          <svg viewBox="0 0 24 24" class="w-5 h-5 text-[#009EE3]" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        </template>
        <!-- checkout_api: ícono tarjeta -->
        <template v-else-if="gw === 'checkout_api'">
          <svg viewBox="0 0 24 24" class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </template>
        <!-- bank_transfer: ícono banco -->
        <template v-else-if="gw === 'bank_transfer'">
          <svg viewBox="0 0 24 24" class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11"/>
          </svg>
        </template>
        <!-- mp_point: ícono POS -->
        <template v-else-if="gw === 'mp_point'">
          <svg viewBox="0 0 24 24" class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <line x1="9" y1="7" x2="15" y2="7"/>
            <line x1="9" y1="11" x2="15" y2="11"/>
            <circle cx="12" cy="17" r="1"/>
          </svg>
        </template>
        <!-- fallback -->
        <template v-else>
          <svg viewBox="0 0 24 24" class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        </template>
      </span>

      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-800">{{ getLabel(gw) }}</p>
        <p class="text-xs text-gray-500">{{ getDescription(gw) }}</p>
      </div>

      <svg class="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
      </svg>
    </button>
  </div>
</template>
