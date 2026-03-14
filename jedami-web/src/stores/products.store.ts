import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchProducts, fetchProduct } from '@/api/products.api'
import type { Product } from '@/types/api'

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const currentProduct = ref<Product | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const page = ref(1)
  const total = ref(0)
  const pageSize = 20

  async function fetchCatalog(reset = false) {
    if (reset) {
      products.value = []
      page.value = 1
    }
    loading.value = true
    error.value = null
    try {
      const res = await fetchProducts(page.value, pageSize)
      products.value = [...products.value, ...res.data]
      total.value = res.meta.total
      page.value++
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      error.value = e.response?.data?.detail ?? 'Error al cargar el catálogo. Intente nuevamente.'
    } finally {
      loading.value = false
    }
  }

  async function loadProduct(id: number) {
    loading.value = true
    error.value = null
    try {
      const res = await fetchProduct(id)
      currentProduct.value = res.data
    } finally {
      loading.value = false
    }
  }

  return { products, currentProduct, loading, error, page, total, pageSize, fetchCatalog, loadProduct }
})
