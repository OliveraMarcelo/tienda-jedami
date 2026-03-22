<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Pie, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js'
import AppLayout from '@/layouts/AppLayout.vue'
import { fetchDashboard, type DashboardData } from '@/api/admin.dashboard.api'
import { useConfigStore } from '@/stores/config.store'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

const router = useRouter()
const configStore = useConfigStore()

const loading = ref(true)
const error = ref('')
const data = ref<DashboardData | null>(null)

onMounted(async () => {
  try {
    data.value = await fetchDashboard()
  } catch {
    error.value = 'Error al cargar el dashboard.'
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

const statusColors: Record<string, string> = {
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid:     'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

const statusLabels: Record<string, string> = {
  pending:  'Pendiente',
  paid:     'Pagado',
  rejected: 'Rechazado',
}

// Datos para el gráfico de torta — pedidos por estado
const pieData = computed(() => {
  const s = data.value?.ordersByStatus
  if (!s) return null
  return {
    labels: ['Pendiente', 'Pagado', 'Rechazado'],
    datasets: [{
      data: [s.pending, s.paid, s.rejected],
      backgroundColor: ['#FEF08A', '#86EFAC', '#FCA5A5'],
      borderColor:     ['#EAB308', '#22C55E', '#EF4444'],
      borderWidth: 2,
    }],
  }
})

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
  },
}

// Datos para el gráfico de barras — pedidos por tipo
const barData = computed(() => {
  const t = data.value?.ordersByType
  if (!t) return null
  const primary = configStore.branding.primaryColor
  const labels = Object.keys(t).map(k => configStore.purchaseTypeLabel[k] ?? k)
  return {
    labels,
    datasets: [{
      label: 'Pedidos',
      data: Object.values(t),
      backgroundColor: primary + '33',
      borderColor: primary,
      borderWidth: 2,
      borderRadius: 8,
    }],
  }
})

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 },
      grid: { color: '#F3F4F6' },
    },
    x: {
      grid: { display: false },
    },
  },
}
</script>

<template>
  <AppLayout>
    <div class="max-w-5xl mx-auto">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/admin')" class="text-sm text-gray-500 hover:text-[var(--color-primary)]">← Admin</button>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div v-for="i in 3" :key="i" class="animate-pulse bg-white rounded-2xl border border-gray-200 h-24"></div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="animate-pulse bg-white rounded-2xl border border-gray-200 h-64"></div>
          <div class="animate-pulse bg-white rounded-2xl border border-gray-200 h-64"></div>
        </div>
        <div class="animate-pulse bg-white rounded-2xl border border-gray-200 h-64"></div>
      </div>

      <p v-else-if="error" class="text-red-500 text-sm">{{ error }}</p>

      <template v-else-if="data">
        <!-- Métricas -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p class="text-sm text-gray-500 mb-1">Total Pedidos</p>
            <p class="text-3xl font-bold text-gray-900">{{ data.totalOrders }}</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p class="text-sm text-gray-500 mb-1">Revenue Total</p>
            <p class="text-3xl font-bold text-gray-900">{{ formatCurrency(data.totalRevenue) }}</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p class="text-sm text-gray-500 mb-1">Últimos 30 días</p>
            <p class="text-3xl font-bold text-[var(--color-primary)]">{{ formatCurrency(data.revenueLast30d) }}</p>
          </div>
        </div>

        <!-- Gráficos -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <!-- Torta: pedidos por estado -->
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p class="text-sm font-semibold text-gray-700 mb-4">Pedidos por estado</p>
            <div class="h-56">
              <Pie v-if="pieData" :data="pieData" :options="pieOptions" />
            </div>
          </div>

          <!-- Barras: pedidos por tipo -->
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <p class="text-sm font-semibold text-gray-700 mb-4">Pedidos por tipo</p>
            <div class="h-56">
              <Bar v-if="barData" :data="barData" :options="barOptions" />
            </div>
          </div>
        </div>

        <!-- Pedidos recientes -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100">
            <p class="text-sm font-semibold text-gray-700">Últimos pedidos</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th class="px-5 py-3 font-medium">Cliente</th>
                  <th class="px-5 py-3 font-medium">Tipo</th>
                  <th class="px-5 py-3 font-medium">Estado</th>
                  <th class="px-5 py-3 font-medium text-right">Monto</th>
                  <th class="px-5 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="order in data.recentOrders"
                  :key="order.id"
                  class="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td class="px-5 py-3 text-gray-800 truncate max-w-[180px]">{{ order.customerEmail }}</td>
                  <td class="px-5 py-3 text-gray-600">{{ configStore.purchaseTypeLabel[order.purchaseType] ?? order.purchaseType }}</td>
                  <td class="px-5 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border"
                      :class="statusColors[order.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'"
                    >
                      {{ statusLabels[order.status] ?? order.status }}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-right font-semibold text-gray-800">{{ formatCurrency(order.totalAmount) }}</td>
                  <td class="px-5 py-3 text-gray-500">{{ formatDate(order.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>
