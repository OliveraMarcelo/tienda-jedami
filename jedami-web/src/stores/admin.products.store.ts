import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createProduct as apiCreate, updateProduct as apiUpdate, createVariant as apiCreateVariant } from '@/api/admin.api'
import { fetchProducts } from '@/api/products.api'
import type { Product, Variant } from '@/types/api'

export const useAdminProductsStore = defineStore('adminProducts', () => {
  const products = ref<Product[]>([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      const res = await fetchProducts(1, 100)
      products.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function createProduct(name: string, description?: string) {
    const res = await apiCreate({ name, description })
    products.value.push({ ...res.data, variants: [] })
    return res.data
  }

  async function updateProduct(id: number, dto: { name?: string; description?: string }) {
    const res = await apiUpdate(id, dto)
    const idx = products.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      products.value[idx] = { ...products.value[idx], ...res.data }
    }
    return res.data
  }

  async function createVariant(productId: number, dto: { size: string; color: string; retailPrice: number; initialStock: number }) {
    const res = await apiCreateVariant(productId, dto)
    const product = products.value.find(p => p.id === productId)
    if (product) {
      const variant: Variant = {
        id: res.data.id,
        size: res.data.size,
        color: res.data.color,
        retailPrice: res.data.retailPrice,
        stock: res.data.stock,
      }
      product.variants.push(variant)
    }
    return res.data
  }

  return { products, loading, fetchAll, createProduct, updateProduct, createVariant }
})
