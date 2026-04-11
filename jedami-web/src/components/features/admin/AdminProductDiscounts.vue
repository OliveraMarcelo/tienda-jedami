<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { QuantityDiscountRule, CurvaDiscountRule } from '@/types/api'
import {
  getAdminDiscountRules,
  createQuantityRule,
  deleteQuantityRule,
  createCurvaRule,
  deleteCurvaRule,
  updateProductMinQuantity,
} from '@/api/discounts.api'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const props = defineProps<{ productId: number }>()
const emit = defineEmits<{ toast: [msg: string] }>()

const quantityRules = ref<QuantityDiscountRule[]>([])
const curvaRules = ref<CurvaDiscountRule[]>([])
const minQuantity = ref<number | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// Formulario nueva regla cantidad
const newQtyMin = ref<number | null>(null)
const newQtyPct = ref<number | null>(null)
const qtyFormError = ref<string | null>(null)
const qtyFormLoading = ref(false)

// Formulario nueva regla curva
const newCurvaMin = ref<number | null>(null)
const newCurvaPct = ref<number | null>(null)
const curvaFormError = ref<string | null>(null)
const curvaFormLoading = ref(false)

// Mínimo de compra
const minQtyInput = ref<number | null>(null)
const minQtyLoading = ref(false)

// Confirmación de eliminación
const confirmOpen = ref(false)
const confirmMessage = ref('')
const confirmCallback = ref<() => void>(() => {})
function askConfirm(message: string, callback: () => void) {
  confirmMessage.value = message
  confirmCallback.value = callback
  confirmOpen.value = true
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await getAdminDiscountRules(props.productId)
    quantityRules.value = data.quantityRules
    curvaRules.value = data.curvaRules
    minQuantity.value = data.minQuantityPurchase ?? null
    minQtyInput.value = minQuantity.value
  } catch {
    error.value = 'No se pudieron cargar los escalones'
  } finally {
    loading.value = false
  }
}

async function saveMinQuantity() {
  minQtyLoading.value = true
  try {
    await updateProductMinQuantity(props.productId, minQtyInput.value)
    minQuantity.value = minQtyInput.value
    emit('toast', 'Mínimo de compra actualizado')
  } catch {
    emit('toast', 'Error al actualizar el mínimo')
  } finally {
    minQtyLoading.value = false
  }
}

async function addQuantityRule() {
  if (!newQtyMin.value || newQtyMin.value <= 0) {
    qtyFormError.value = 'La cantidad mínima debe ser mayor a 0'
    return
  }
  if (!newQtyPct.value || newQtyPct.value <= 0 || newQtyPct.value >= 100) {
    qtyFormError.value = 'El descuento debe estar entre 1 y 99'
    return
  }
  qtyFormError.value = null
  qtyFormLoading.value = true
  try {
    const rule = await createQuantityRule(props.productId, {
      minQuantity: newQtyMin.value,
      discountPct: newQtyPct.value,
    })
    quantityRules.value.push(rule)
    newQtyMin.value = null
    newQtyPct.value = null
    emit('toast', 'Escalón de cantidad creado')
  } catch (err: unknown) {
    const e = err as { response?: { status?: number } }
    qtyFormError.value =
      e.response?.status === 409
        ? 'Ya existe un escalón con esa cantidad mínima'
        : 'Error al crear el escalón'
  } finally {
    qtyFormLoading.value = false
  }
}

function removeQuantityRule(ruleId: number) {
  askConfirm('¿Eliminar este escalón de cantidad?', async () => {
    try {
      await deleteQuantityRule(props.productId, ruleId)
      quantityRules.value = quantityRules.value.filter(r => r.id !== ruleId)
      emit('toast', 'Escalón eliminado')
    } catch {
      emit('toast', 'Error al eliminar el escalón')
    }
  })
}

async function addCurvaRule() {
  if (!newCurvaMin.value || newCurvaMin.value <= 0) {
    curvaFormError.value = 'El mínimo de curvas debe ser mayor a 0'
    return
  }
  if (!newCurvaPct.value || newCurvaPct.value <= 0 || newCurvaPct.value >= 100) {
    curvaFormError.value = 'El descuento debe estar entre 1 y 99'
    return
  }
  curvaFormError.value = null
  curvaFormLoading.value = true
  try {
    const rule = await createCurvaRule(props.productId, {
      minCurves: newCurvaMin.value,
      discountPct: newCurvaPct.value,
    })
    curvaRules.value.push(rule)
    newCurvaMin.value = null
    newCurvaPct.value = null
    emit('toast', 'Escalón de curva creado')
  } catch (err: unknown) {
    const e = err as { response?: { status?: number } }
    curvaFormError.value =
      e.response?.status === 409
        ? 'Ya existe un escalón con ese mínimo de curvas'
        : 'Error al crear el escalón'
  } finally {
    curvaFormLoading.value = false
  }
}

function removeCurvaRule(ruleId: number) {
  askConfirm('¿Eliminar este escalón de curva?', async () => {
    try {
      await deleteCurvaRule(props.productId, ruleId)
      curvaRules.value = curvaRules.value.filter(r => r.id !== ruleId)
      emit('toast', 'Escalón eliminado')
    } catch {
      emit('toast', 'Error al eliminar el escalón')
    }
  })
}

onMounted(load)
</script>

<template>
  <div class="space-y-6 pt-4">
    <div v-if="loading" class="text-sm text-gray-400 py-4 text-center">Cargando escalones…</div>
    <div v-else-if="error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{{ error }}</div>

    <template v-else>
      <!-- Mínimo de compra -->
      <div>
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mínimo de compra (unidades)</p>
        <div class="flex items-center gap-2">
          <input
            v-model.number="minQtyInput"
            type="number"
            min="1"
            step="1"
            placeholder="Sin mínimo"
            class="w-36 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
          />
          <button
            @click="saveMinQuantity"
            :disabled="minQtyLoading"
            class="px-3 py-1.5 rounded-lg bg-[#1565C0] text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {{ minQtyLoading ? 'Guardando…' : 'Guardar' }}
          </button>
          <button
            v-if="minQtyInput"
            @click="minQtyInput = null; saveMinQuantity()"
            class="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Quitar mínimo
          </button>
        </div>
      </div>

      <!-- Escalones por cantidad -->
      <div>
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Escalones por cantidad</p>

        <table v-if="quantityRules.length" class="w-full text-sm border border-gray-100 rounded-xl overflow-hidden mb-3">
          <thead class="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th class="px-3 py-2 text-left font-medium">Desde (uds.)</th>
              <th class="px-3 py-2 text-left font-medium">Descuento</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in quantityRules" :key="rule.id" class="border-t border-gray-100">
              <td class="px-3 py-2 text-gray-700">{{ rule.min_quantity }}</td>
              <td class="px-3 py-2 text-green-700 font-semibold">{{ rule.discount_pct }}%</td>
              <td class="px-3 py-2 text-right">
                <button
                  @click="removeQuantityRule(rule.id)"
                  class="text-red-500 hover:text-red-700 text-xs font-semibold transition-colors"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-xs text-gray-400 italic mb-3">Sin escalones configurados</p>

        <!-- Formulario agregar -->
        <div class="flex items-start gap-2 flex-wrap">
          <div>
            <input
              v-model.number="newQtyMin"
              type="number"
              min="1"
              placeholder="Desde (uds.)"
              class="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
            />
          </div>
          <div>
            <input
              v-model.number="newQtyPct"
              type="number"
              min="1"
              max="99"
              placeholder="% descuento"
              class="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
            />
          </div>
          <button
            @click="addQuantityRule"
            :disabled="qtyFormLoading"
            class="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {{ qtyFormLoading ? 'Agregando…' : '+ Agregar' }}
          </button>
        </div>
        <p v-if="qtyFormError" class="text-xs text-red-600 mt-1">{{ qtyFormError }}</p>
      </div>

      <!-- Escalones por curva -->
      <div>
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Escalones por curva</p>

        <table v-if="curvaRules.length" class="w-full text-sm border border-gray-100 rounded-xl overflow-hidden mb-3">
          <thead class="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th class="px-3 py-2 text-left font-medium">Desde (curvas)</th>
              <th class="px-3 py-2 text-left font-medium">Descuento</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in curvaRules" :key="rule.id" class="border-t border-gray-100">
              <td class="px-3 py-2 text-gray-700">{{ rule.min_curves }}</td>
              <td class="px-3 py-2 text-green-700 font-semibold">{{ rule.discount_pct }}%</td>
              <td class="px-3 py-2 text-right">
                <button
                  @click="removeCurvaRule(rule.id)"
                  class="text-red-500 hover:text-red-700 text-xs font-semibold transition-colors"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-xs text-gray-400 italic mb-3">Sin escalones configurados</p>

        <!-- Formulario agregar -->
        <div class="flex items-start gap-2 flex-wrap">
          <div>
            <input
              v-model.number="newCurvaMin"
              type="number"
              min="1"
              placeholder="Desde (curvas)"
              class="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
            />
          </div>
          <div>
            <input
              v-model.number="newCurvaPct"
              type="number"
              min="1"
              max="99"
              placeholder="% descuento"
              class="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
            />
          </div>
          <button
            @click="addCurvaRule"
            :disabled="curvaFormLoading"
            class="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {{ curvaFormLoading ? 'Agregando…' : '+ Agregar' }}
          </button>
        </div>
        <p v-if="curvaFormError" class="text-xs text-red-600 mt-1">{{ curvaFormError }}</p>
      </div>
    </template>
  </div>

  <ConfirmDialog
    :open="confirmOpen"
    :message="confirmMessage"
    @update:open="confirmOpen = $event"
    @confirm="confirmCallback()"
  />
</template>
