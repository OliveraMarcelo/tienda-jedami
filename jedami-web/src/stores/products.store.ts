import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchProducts, fetchProduct, fetchCategories, fetchSizes, fetchColors } from '@/api/products.api'
import type { Product, Category, Size, Color } from '@/types/api'

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const currentProduct = ref<Product | null>(null)
  const categories = ref<Category[]>([])
  const sizes = ref<Size[]>([])
  const colors = ref<Color[]>([])
  const selectedCategoryId = ref<number | null>(null)
  const search = ref<string | null>(null)
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
      const res = await fetchProducts(page.value, pageSize, selectedCategoryId.value, search.value)
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

  async function filterByCategory(categoryId: number | null) {
    selectedCategoryId.value = categoryId
    await fetchCatalog(true)
  }

  async function filterBySearch(term: string | null) {
    search.value = term || null
    await fetchCatalog(true)
  }

  async function loadCategories() {
    try {
      const res = await fetchCategories()
      categories.value = res.data
    } catch {
      // Silencioso
    }
  }

  async function loadSizes() {
    if (sizes.value.length > 0) return
    try {
      const res = await fetchSizes()
      sizes.value = res.data
    } catch {
      // Silencioso
    }
  }

  async function loadColors() {
    if (colors.value.length > 0) return
    try {
      const res = await fetchColors()
      colors.value = res.data
    } catch {
      // Silencioso
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

  return {
    products,
    currentProduct,
    categories,
    sizes,
    colors,
    selectedCategoryId,
    search,
    loading,
    error,
    page,
    total,
    pageSize,
    fetchCatalog,
    filterByCategory,
    filterBySearch,
    loadCategories,
    loadSizes,
    loadColors,
    loadProduct,
  }
})
