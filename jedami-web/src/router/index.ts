import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { ROLES } from '@/lib/constants'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/catalogo' },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    { path: '/registro', name: 'registro', component: () => import('@/views/RegisterView.vue') },
    { path: '/catalogo', name: 'catalogo', component: () => import('@/views/CatalogView.vue') },
    { path: '/catalogo/:id', name: 'producto', component: () => import('@/views/ProductView.vue') },
    {
      path: '/pedidos',
      name: 'pedidos',
      component: () => import('@/views/OrdersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pedidos/:orderId',
      name: 'pedidoDetalle',
      component: () => import('@/views/OrderDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pedidos/:orderId/confirmacion',
      name: 'pagoConfirmacion',
      component: () => import('@/views/PaymentConfirmationView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/perfil',
      name: 'perfil',
      component: () => import('@/views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/admin/AdminView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
    {
      path: '/admin/dashboard',
      name: 'adminDashboard',
      component: () => import('@/views/admin/AdminDashboardView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
    {
      path: '/admin/pagos',
      name: 'adminPagos',
      component: () => import('@/views/admin/AdminPaymentsView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
    {
      path: '/admin/productos',
      name: 'adminProductos',
      component: () => import('@/views/admin/AdminProductsView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
    {
      path: '/admin/usuarios',
      name: 'adminUsuarios',
      component: () => import('@/views/admin/AdminUsersView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
    {
      path: '/admin/configuracion',
      name: 'adminConfiguracion',
      component: () => import('@/views/admin/AdminConfigView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
    {
      path: '/admin/despacho',
      name: 'adminDespacho',
      component: () => import('@/views/admin/AdminFulfillmentView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
    {
      path: '/admin/banners',
      name: 'adminBanners',
      component: () => import('@/views/admin/AdminBannersView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
    {
      path: '/admin/anuncios',
      name: 'adminAnuncios',
      component: () => import('@/views/admin/AdminAnnouncementsView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
    {
      path: '/admin/point',
      name: 'adminPoint',
      component: () => import('@/views/admin/AdminPointView.vue'),
      meta: { requiresRole: ROLES.ADMIN },
    },
  ],
})

const GUEST_ONLY_ROUTES = ['login', 'registro']

router.beforeEach((to) => {
  const authStore = useAuthStore()

  // Redirigir usuario autenticado fuera de rutas de invitado
  if (authStore.isAuthenticated && to.name && GUEST_ONLY_ROUTES.includes(to.name as string)) {
    return { name: authStore.isAdmin ? 'admin' : 'catalogo' }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.meta.requiresRole === ROLES.ADMIN && !authStore.isAdmin) {
    return { name: 'catalogo' }
  }
})

export default router
