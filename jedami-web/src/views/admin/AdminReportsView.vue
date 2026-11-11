<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { fetchAdminReports, type ReportsData } from '@/api/admin.reports.api'


const loading = ref(true)
const error   = ref('')
const reports = ref<ReportsData | null>(null)

async function load() {
  loading.value = true
  error.value   = ''
  try {
    reports.value = await fetchAdminReports()
  } catch {
    error.value = 'Error al cargar los reportes'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const formatPrice = (n: number) =>
  '$ ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
</script>

<template>
  <AdminLayout>
    <div class="max-w-5xl">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-6">
        <h1 class="text-[26px] font-bold">Reportes</h1>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-6">
        <div class="bg-white rounded-xl border border-[var(--a-border)] p-5 space-y-3">
          <div class="animate-pulse bg-gray-100 rounded h-5 w-48"></div>
          <div v-for="i in 5" :key="i" class="animate-pulse bg-[var(--a-bg)] rounded-xl border h-10"></div>
        </div>
        <div class="bg-white rounded-xl border border-[var(--a-border)] p-5 space-y-3">
          <div class="animate-pulse bg-gray-100 rounded h-5 w-48"></div>
          <div v-for="i in 5" :key="i" class="animate-pulse bg-[var(--a-bg)] rounded-xl border h-10"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="bg-white rounded-xl border border-[var(--a-border)] p-8 text-center">
        <p class="text-red-500 text-sm mb-4">{{ error }}</p>
        <button
          @click="load"
          class="px-4 py-2 rounded-xl bg-[var(--a-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Reintentar
        </button>
      </div>

      <template v-else-if="reports">
        <!-- Tabla productos más vendidos -->
        <div class="bg-white rounded-xl border border-[var(--a-border)] overflow-hidden mb-6">
          <div class="px-5 py-4 border-b border-[var(--a-border)]">
            <p class="text-sm font-semibold text-[#45494E]">Productos más vendidos</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-[var(--a-muted)] border-b border-[var(--a-border)]">
                  <th class="px-5 py-3 font-medium">#</th>
                  <th class="px-5 py-3 font-medium">Producto</th>
                  <th class="px-5 py-3 font-medium text-right">Unidades vendidas</th>
                  <th class="px-5 py-3 font-medium text-right">Revenue total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(product, idx) in reports.topProducts"
                  :key="product.productId"
                  class="border-b border-[var(--a-border)] hover:bg-[var(--a-bg)] transition-colors"
                >
                  <td class="px-5 py-3 text-[var(--a-muted)] text-xs">{{ idx + 1 }}</td>
                  <td class="px-5 py-3 font-medium text-[var(--a-ink)]">{{ product.name }}</td>
                  <td class="px-5 py-3 text-right text-[#45494E]">{{ product.totalUnits }}</td>
                  <td class="px-5 py-3 text-right font-semibold text-[var(--a-ink)]">{{ formatPrice(product.totalRevenue) }}</td>
                </tr>
                <tr v-if="reports.topProducts.length === 0">
                  <td colspan="4" class="px-5 py-6 text-center text-[var(--a-muted)] text-sm">Sin datos de ventas aún</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tabla clientes con más pedidos -->
        <div class="bg-white rounded-xl border border-[var(--a-border)] overflow-hidden">
          <div class="px-5 py-4 border-b border-[var(--a-border)]">
            <p class="text-sm font-semibold text-[#45494E]">Clientes con más pedidos</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-[var(--a-muted)] border-b border-[var(--a-border)]">
                  <th class="px-5 py-3 font-medium">#</th>
                  <th class="px-5 py-3 font-medium">Email</th>
                  <th class="px-5 py-3 font-medium text-right">Total pedidos</th>
                  <th class="px-5 py-3 font-medium text-right">Revenue total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(customer, idx) in reports.topCustomers"
                  :key="customer.customerId"
                  class="border-b border-[var(--a-border)] hover:bg-[var(--a-bg)] transition-colors"
                >
                  <td class="px-5 py-3 text-[var(--a-muted)] text-xs">{{ idx + 1 }}</td>
                  <td class="px-5 py-3 text-[var(--a-ink)] truncate max-w-[220px]">{{ customer.email }}</td>
                  <td class="px-5 py-3 text-right text-[#45494E]">{{ customer.totalOrders }}</td>
                  <td class="px-5 py-3 text-right font-semibold text-[var(--a-ink)]">{{ formatPrice(customer.totalRevenue) }}</td>
                </tr>
                <tr v-if="reports.topCustomers.length === 0">
                  <td colspan="4" class="px-5 py-6 text-center text-[var(--a-muted)] text-sm">Sin datos de clientes aún</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </AdminLayout>
</template>
