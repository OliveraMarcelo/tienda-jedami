import { AppError } from '../../types/app-error.js';
import * as productsRepository from './products.repository.js';
import type { CatalogRow } from './products.repository.js';

// ─── Response Types ───────────────────────────────────────────────────────────

interface VariantResponse {
  id: number;
  sizeId: number;
  size: string;
  colorId: number;
  color: string;
  hexCode: string | null;
  stock: { quantity: number };
}

interface ProductResponse {
  id: number;
  name: string;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  imageUrl: string | null;
  retailPrice: number | null;
  wholesalePrice: number | null;
  variants: VariantResponse[];
}

interface ProductDetailResponse extends ProductResponse {
  images: { id: number; url: string; position: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupRowsIntoProducts(rows: CatalogRow[]): ProductResponse[] {
  const map = new Map<number, ProductResponse>();
  for (const row of rows) {
    if (!map.has(row.product_id)) {
      map.set(row.product_id, {
        id: row.product_id,
        name: row.product_name,
        description: row.product_description,
        categoryId: row.product_category_id ?? null,
        categoryName: row.product_category_name ?? null,
        imageUrl: row.image_url ?? null,
        retailPrice: row.product_retail_price != null ? Number(row.product_retail_price) : null,
        wholesalePrice: row.product_wholesale_price != null ? Number(row.product_wholesale_price) : null,
        variants: [],
      });
    }
    if (row.variant_id !== null) {
      map.get(row.product_id)!.variants.push({
        id: row.variant_id,
        sizeId: row.variant_size_id!,
        size: row.variant_size!,
        colorId: row.variant_color_id!,
        color: row.variant_color!,
        hexCode: row.variant_color_hex ?? null,
        stock: { quantity: row.stock_quantity ?? 0 },
      });
    }
  }
  return Array.from(map.values());
}

// ─── Create / Update Product ──────────────────────────────────────────────────

interface CreateProductDTO {
  name: string;
  description?: string;
  categoryId?: number | null;
}

export async function createProduct(dto: CreateProductDTO) {
  if (!dto.name?.trim()) {
    throw new AppError(400, 'Nombre requerido', 'https://jedami.com/errors/validation', 'El campo name es obligatorio');
  }
  const product = await productsRepository.createProduct(dto.name.trim(), dto.description, dto.categoryId);
  return { id: product.id, name: product.name, description: product.description, categoryId: product.category_id ?? null };
}

export async function updateProduct(
  id: number,
  dto: { name?: string; description?: string | null; categoryId?: number | null },
) {
  const existing = await productsRepository.findById(id);
  if (!existing) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${id}`);
  }
  const description = dto.description === undefined ? existing.description : (dto.description ?? null);
  const categoryId = dto.categoryId === undefined ? existing.category_id : dto.categoryId;
  const updated = await productsRepository.updateProduct(id, { name: dto.name, description, categoryId });
  return {
    id: updated!.id,
    name: updated!.name,
    description: updated!.description,
    categoryId: updated!.category_id ?? null,
  };
}

export async function updateProductPrices(
  productId: number,
  dto: { retailPrice: number; wholesalePrice: number | null },
) {
  if (dto.retailPrice < 0) {
    throw new AppError(400, 'Valores inválidos', 'https://jedami.com/errors/validation', 'retailPrice debe ser >= 0');
  }
  if (dto.wholesalePrice != null && dto.wholesalePrice < 0) {
    throw new AppError(400, 'Valores inválidos', 'https://jedami.com/errors/validation', 'wholesalePrice debe ser >= 0');
  }
  const existing = await productsRepository.findById(productId);
  if (!existing) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${productId}`);
  }
  await productsRepository.upsertProductPrice(productId, 'retail', dto.retailPrice);
  if (dto.wholesalePrice != null) {
    await productsRepository.upsertProductPrice(productId, 'wholesale', dto.wholesalePrice);
  } else {
    await productsRepository.deleteProductPrice(productId, 'wholesale');
  }
}

// ─── Variants ─────────────────────────────────────────────────────────────────

interface CreateVariantDTO {
  sizeId: number;
  colorId: number;
  initialStock: number;
}

export async function createVariant(productId: number, dto: CreateVariantDTO) {
  if (!dto.sizeId || !dto.colorId || dto.initialStock == null) {
    throw new AppError(400, 'Datos de variante incompletos', 'https://jedami.com/errors/validation', 'Faltan campos requeridos: sizeId, colorId, initialStock');
  }
  if (dto.initialStock < 0) {
    throw new AppError(400, 'Valores inválidos', 'https://jedami.com/errors/validation', 'initialStock debe ser >= 0');
  }

  const product = await productsRepository.findById(productId);
  if (!product) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${productId}`);
  }

  const [size, color] = await Promise.all([
    productsRepository.findSizeById(dto.sizeId),
    productsRepository.findColorById(dto.colorId),
  ]);
  if (!size) {
    throw new AppError(400, 'Talle inválido', 'https://jedami.com/errors/validation', `No existe talle con id ${dto.sizeId}`);
  }
  if (!color) {
    throw new AppError(400, 'Color inválido', 'https://jedami.com/errors/validation', `No existe color con id ${dto.colorId}`);
  }

  const { variant, stock } = await productsRepository.createVariantWithStock(productId, dto.sizeId, dto.colorId, dto.initialStock);
  return {
    id: variant.id,
    productId: variant.product_id,
    sizeId: size.id,
    size: size.label,
    colorId: color.id,
    color: color.name,
    hexCode: color.hex_code ?? null,
    stock: { quantity: stock.quantity },
  };
}

// ─── Reference Data ───────────────────────────────────────────────────────────

export async function listSizes() {
  return productsRepository.getSizes();
}

export async function listColors() {
  return productsRepository.getColors();
}

// ─── Product Images ───────────────────────────────────────────────────────────

export async function addImage(productId: number, url: string, position?: number) {
  if (!url?.trim()) {
    throw new AppError(400, 'URL requerida', 'https://jedami.com/errors/validation', 'El campo url es obligatorio');
  }
  const product = await productsRepository.findById(productId);
  if (!product) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${productId}`);
  }
  const image = await productsRepository.addImage(productId, url.trim(), position ?? 0);
  return { id: image.id, productId: image.product_id, url: image.url, position: image.position };
}

export async function deleteImage(productId: number, imageId: number) {
  const images = await productsRepository.findImagesByProductId(productId);
  const image = images.find(img => img.id === imageId);
  const deleted = await productsRepository.deleteImage(imageId, productId);
  if (!deleted) {
    throw new AppError(404, 'Imagen no encontrada', 'https://jedami.com/errors/not-found', `No existe imagen con id ${imageId} para el producto ${productId}`);
  }
  if (image?.url) {
    const filename = image.url.split('/uploads/products/')[1];
    if (filename) {
      const { unlink } = await import('fs/promises');
      const { UPLOADS_DIR } = await import('../../config/upload.js');
      await unlink(`${UPLOADS_DIR}/${filename}`).catch(() => { /* silencioso si ya no existe */ });
    }
  }
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function findById(id: number) {
  const product = await productsRepository.findById(id);
  if (!product) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${id}`);
  }
  return { id: product.id, name: product.name, description: product.description, categoryId: product.category_id ?? null };
}

export async function getCatalog(page: number, pageSize: number, categoryId?: number | null) {
  const offset = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    productsRepository.findAllWithVariants(pageSize, offset, categoryId),
    productsRepository.countProducts(categoryId),
  ]);
  return { products: groupRowsIntoProducts(rows), total };
}

export async function deleteProduct(id: number) {
  const deleted = await productsRepository.deleteProduct(id);
  if (!deleted) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${id}`);
  }
}

export async function deleteVariant(productId: number, variantId: number) {
  const deleted = await productsRepository.deleteVariant(variantId, productId);
  if (!deleted) {
    throw new AppError(404, 'Variante no encontrada', 'https://jedami.com/errors/not-found', `No existe variante ${variantId} en producto ${productId}`);
  }
}

export async function updateStock(productId: number, variantId: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new AppError(400, 'Cantidad inválida', 'https://jedami.com/errors/validation', 'quantity debe ser un entero >= 0');
  }
  const variant = await productsRepository.findVariantById(variantId);
  if (!variant || variant.product_id !== productId) {
    throw new AppError(404, 'Variante no encontrada', 'https://jedami.com/errors/not-found', `No existe variante ${variantId} en producto ${productId}`);
  }
  await productsRepository.updateStock(variantId, quantity);
}

export async function getProductWithVariants(id: number): Promise<ProductDetailResponse> {
  const [rows, images] = await Promise.all([
    productsRepository.findByIdWithVariants(id),
    productsRepository.findImagesByProductId(id),
  ]);
  if (rows.length === 0) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${id}`);
  }
  const product = groupRowsIntoProducts(rows)[0];
  return {
    ...product,
    imageUrl: images.length > 0 ? (images[0].url ?? null) : null,
    images: images.map(i => ({ id: i.id, url: i.url, position: i.position })),
  };
}
