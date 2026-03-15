import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createProduct as apiCreate,
  updateProduct as apiUpdate,
  updateProductPrices as apiUpdateProductPrices,
  createVariant as apiCreateVariant,
  deleteImage as apiDeleteImage,
  deleteProduct as apiDeleteProduct,
  deleteVariant as apiDeleteVariant,
  updateStock as apiUpdateStock,
} from '@/api/admin.api'
import { fetchProducts } from '@/api/products.api'
import type { Product, Variant } from '@/types/api'

export const useAdminProductsStore = defineStore('adminProducts', () => {
  const products = ref<Product[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalProducts = ref(0)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const res = await fetchProducts(1, 100)
      products.value = res.data
      totalProducts.value = res.meta.total
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      error.value = e.response?.data?.detail ?? 'Error al cargar los productos.'
    } finally {
      loading.value = false
    }
  }

  async function createProduct(name: string, description?: string, categoryId?: number | null) {
    const res = await apiCreate({ name, description, categoryId })
    products.value.push({ ...res.data, variants: [] })
    totalProducts.value++
    return res.data
  }

  async function updateProduct(id: number, dto: { name?: string; description?: string; categoryId?: number | null }) {
    const res = await apiUpdate(id, dto)
    const idx = products.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      products.value[idx] = { ...products.value[idx], ...res.data }
    }
    return res.data
  }

  async function updateProductPrices(productId: number, dto: { retailPrice: number; wholesalePrice: number | null }) {
    await apiUpdateProductPrices(productId, dto)
    const product = products.value.find(p => p.id === productId)
    if (product) {
      product.retailPrice = dto.retailPrice
      product.wholesalePrice = dto.wholesalePrice
    }
  }

  async function createVariant(productId: number, dto: { sizeId: number; colorId: number; initialStock: number }) {
    const res = await apiCreateVariant(productId, dto)
    const product = products.value.find(p => p.id === productId)
    if (product) {
      const variant: Variant = {
        id: res.data.id,
        sizeId: res.data.sizeId,
        size: res.data.size,
        colorId: res.data.colorId,
        color: res.data.color,
        hexCode: res.data.hexCode ?? null,
        stock: res.data.stock,
      }
      product.variants.push(variant)
    }
    return res.data
  }

  async function deleteImage(productId: number, imageId: number) {
    await apiDeleteImage(productId, imageId)
    const product = products.value.find(p => p.id === productId)
    if (product?.images) {
      product.images = product.images.filter(img => img.id !== imageId)
    }
  }

  async function deleteProduct(id: number) {
    await apiDeleteProduct(id)
    products.value = products.value.filter(p => p.id !== id)
    totalProducts.value--
  }

  async function deleteVariant(productId: number, variantId: number) {
    await apiDeleteVariant(productId, variantId)
    const product = products.value.find(p => p.id === productId)
    if (product) product.variants = product.variants.filter(v => v.id !== variantId)
  }

  async function updateVariantStock(productId: number, variantId: number, quantity: number) {
    await apiUpdateStock(productId, variantId, quantity)
    const product = products.value.find(p => p.id === productId)
    if (product) {
      const variant = product.variants.find(v => v.id === variantId)
      if (variant) variant.stock.quantity = quantity
    }
  }

  return {
    products,
    loading,
    error,
    totalProducts,
    fetchAll,
    createProduct,
    updateProduct,
    updateProductPrices,
    createVariant,
    deleteImage,
    deleteProduct,
    deleteVariant,
    updateVariantStock,
  }
})
