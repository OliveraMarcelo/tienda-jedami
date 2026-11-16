<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { fetchDashboard, type DashboardData } from '@/api/admin.dashboard.api'
import { fetchAdminReports, type ReportsData } from '@/api/admin.reports.api'
import { useConfigStore } from '@/stores/config.store'

const configStore = useConfigStore()

const loading = ref(true)
const error = ref('')
const data = ref<DashboardData | null>(null)
const reports = ref<ReportsData | null>(null)

onMounted(async () => {
  try {
    const [d, r] = await Promise.all([fetchDashboard(), fetchAdminReports(5)])
    data.value = d
    reports.value = r
  } catch {
    error.value = 'Error al cargar el tablero.'
  } finally {
    loading.value = false
  }
})

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const STATUS: Record<string, { label: string; classes: string }> = {
  pending:   { label: 'Esperando pago', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  paid:      { label: 'Para despachar', classes: 'bg-green-50 text-green-700 border-green-200' },
  shipped:   { label: 'Despachado',     classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  rejected:  { label: 'Rechazado',      classes: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelado',      classes: 'bg-gray-50 text-gray-500 border-gray-200' },
}

// Ventas por forma de compra, como barras simples
const byType = computed(() => {
  const t = data.value?.ordersByType ?? {}
  const max = Math.max(1, ...Object.values(t))
  return Object.entries(t).map(([code, n]) => ({
    label: configStore.purchaseTypeLabel[code] ?? code,
    n,
    pct: Math.round((n / max) * 100),
  }))
})
</script>

<template>
  <AdminLayout>
    <div class="max-w-5xl">
      <h1 class="text-[26px] font-bold mb-6">Tablero</h1>

      <div v-if="loading" class="space-y-4">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div v-for="i in 4" :key="i" class="animate-pulse bg-white rounded-xl border border-[var(--a-border)] h-24"></div>
        </div>
        <div class="animate-pulse bg-white rounded-xl border border-[var(--a-border)] h-64"></div>
      </div>

      <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <template v-else-if="data">
        <!-- Lo que hay que hacer y cómo vienen las ventas -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <RouterLink
            to="/admin/despacho"
            class="rounded-xl border p-4 transition-colors"
            :class="data.ordersByStatus.paid > 0 ? 'bg-green-50 border-green-200 hover:border-green-400' : 'bg-white border-[var(--a-border)] hover:border-gray-300'"
          >
            <p class="text-sm text-[var(--a-muted)] mb-1">Para despachar</p>
            <p class="text-3xl font-bold" :class="data.ordersByStatus.paid > 0 ? 'text-green-700' : 'text-[var(--a-ink)]'">{{ data.ordersByStatus.paid }}</p>
            <p v-if="data.ordersByStatus.paid > 0" class="text-xs font-semibold text-green-700 mt-1">Ir a despacho →</p>
          </RouterLink>
          <RouterLink to="/admin/pagos" class="bg-white rounded-xl border border-[var(--a-border)] p-4 hover:border-gray-300 transition-colors">
            <p class="text-sm text-[var(--a-muted)] mb-1">Esperando pago</p>
            <p class="text-3xl font-bold text-[var(--a-ink)]">{{ data.ordersByStatus.pending }}</p>
          </RouterLink>
          <div class="bg-white rounded-xl border border-[var(--a-border)] p-4">
            <p class="text-sm text-[var(--a-muted)] mb-1">Ventas últimos 30 días</p>
            <p class="text-2xl sm:text-3xl font-bold text-[var(--a-primary)]">{{ formatCurrency(data.revenueLast30d) }}</p>
          </div>
          <div class="bg-white rounded-xl border border-[var(--a-border)] p-4">
            <p class="text-sm text-[var(--a-muted)] mb-1">Ventas totales</p>
            <p class="text-2xl sm:text-3xl font-bold text-[var(--a-ink)]">{{ formatCurrency(data.totalRevenue) }}</p>
            <p class="text-xs text-[var(--a-muted)] mt-1">{{ data.totalOrders }} {{ data.totalOrders === 1 ? 'pedido' : 'pedidos' }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <!-- Más vendidos -->
          <section class="bg-white rounded-xl border border-[var(--a-border)] overflow-hidden">
            <h2 class="px-5 py-4 border-b border-[var(--a-border)] text-sm font-semibold text-[#45494E]">Productos más vendidos</h2>
            <p v-if="!reports?.topProducts.length" class="px-5 py-6 text-sm text-center text-[var(--a-muted)]">Todavía no hay ventas.</p>
            <ol v-else>
              <li v-for="(p, i) in reports.topProducts" :key="p.productId" class="flex items-center gap-3 px-5 py-3 border-b border-[var(--a-border)] last:border-0 text-sm">
                <span class="w-5 text-[var(--a-muted)]">{{ i + 1 }}</span>
                <span class="flex-1 min-w-0 truncate text-[var(--a-ink)]">{{ p.name }}</span>
                <span class="text-[var(--a-muted)] whitespace-nowrap">{{ p.totalUnits }} u.</span>
                <span class="w-24 text-right font-semibold whitespace-nowrap">{{ formatCurrency(p.totalRevenue) }}</span>
              </li>
            </ol>
          </section>

          <!-- Mejores clientes -->
          <section class="bg-white rounded-xl border border-[var(--a-border)] overflow-hidden">
            <h2 class="px-5 py-4 border-b border-[var(--a-border)] text-sm font-semibold text-[#45494E]">Mejores clientes</h2>
            <p v-if="!reports?.topCustomers.length" class="px-5 py-6 text-sm text-center text-[var(--a-muted)]">Todavía no hay ventas.</p>
            <ol v-else>
              <li v-for="(c, i) in reports.topCustomers" :key="c.customerId" class="flex items-center gap-3 px-5 py-3 border-b border-[var(--a-border)] last:border-0 text-sm">
                <span class="w-5 text-[var(--a-muted)]">{{ i + 1 }}</span>
                <span class="flex-1 min-w-0 truncate text-[var(--a-ink)]" :title="c.email">{{ c.email }}</span>
                <span class="text-[var(--a-muted)] whitespace-nowrap">{{ c.totalOrders }} {{ c.totalOrders === 1 ? 'pedido' : 'pedidos' }}</span>
                <span class="w-24 text-right font-semibold whitespace-nowrap">{{ formatCurrency(c.totalRevenue) }}</span>
              </li>
            </ol>
          </section>
        </div>

        <!-- Ventas por forma de compra -->
        <section v-if="data.totalOrders > 0" class="bg-white rounded-xl border border-[var(--a-border)] p-5 mb-6">
          <h2 class="text-sm font-semibold text-[#45494E] mb-4">Ventas por forma de compra</h2>
          <div class="space-y-2.5">
            <div v-for="t in byType" :key="t.label" class="flex items-center gap-3 text-sm">
              <span class="w-24 shrink-0 text-[var(--a-muted)]">{{ t.label }}</span>
              <span class="flex-1 h-2.5 rounded-full bg-[var(--a-bg)] overflow-hidden">
                <span class="block h-full rounded-full bg-[var(--a-primary)]" :style="{ width: `${t.pct}%` }"></span>
              </span>
              <span class="w-8 text-right font-semibold">{{ t.n }}</span>
            </div>
          </div>
        </section>

        <!-- Últimos pedidos -->
        <section class="bg-white rounded-xl border border-[var(--a-border)] overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--a-border)]">
            <h2 class="text-sm font-semibold text-[#45494E]">Últimos pedidos</h2>
            <RouterLink to="/admin/pagos" class="text-xs font-semibold text-[var(--a-primary)] hover:underline">Ver todos →</RouterLink>
          </div>
          <p v-if="!data.recentOrders.length" class="px-5 py-6 text-sm text-center text-[var(--a-muted)]">Todavía no hay pedidos.</p>
          <ul v-else>
            <li v-for="o in data.recentOrders" :key="o.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 border-b border-[var(--a-border)] last:border-0 text-sm">
              <span class="font-semibold text-[var(--a-ink)]">#{{ o.id }}</span>
              <span class="flex-1 min-w-[140px] truncate text-[var(--a-ink)]">{{ o.customerEmail }}</span>
              <span class="text-[var(--a-muted)] hidden sm:inline">{{ configStore.purchaseTypeLabel[o.purchaseType] ?? o.purchaseType }}</span>
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border" :class="STATUS[o.status]?.classes">
                {{ STATUS[o.status]?.label ?? o.status }}
              </span>
              <span class="w-24 text-right font-semibold">{{ formatCurrency(o.totalAmount) }}</span>
              <span class="w-16 text-right text-[var(--a-muted)] hidden sm:inline">{{ formatDate(o.createdAt) }}</span>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </AdminLayout>
</template>
