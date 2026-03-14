import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchProducts, fetchProduct } from '@/api/products.api'
import type { Product } from '@/types/api'

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const currentProduct = ref<Product | null>(null)
  const loading = ref(false)
  const page = ref(1)
  const total = ref(0)
  const pageSize = 20

  async function fetchCatalog(reset = false) {
    if (reset) {
      products.value = []
      page.value = 1
    }
    loading.value = true
    try {
      const res = await fetchProducts(page.value, pageSize)
      products.value = [...products.value, ...res.data]
      total.value = res.meta.total
      page.value++
    } finally {
      loading.value = false
    }
  }

  async function loadProduct(id: number) {
    loading.value = true
    try {
      const res = await fetchProduct(id)
      currentProduct.value = res.data
    } finally {
      loading.value = false
    }
  }

  return { products, currentProduct, loading, page, total, pageSize, fetchCatalog, loadProduct }
})
