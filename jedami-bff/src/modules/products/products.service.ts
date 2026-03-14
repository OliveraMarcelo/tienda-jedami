import { AppError } from '../../types/app-error.js';
import * as productsRepository from './products.repository.js';
import type { CatalogRow } from './products.repository.js';

interface VariantResponse {
  id: number;
  size: string;
  color: string;
  retailPrice: number;
  stock: { quantity: number };
}

interface ProductResponse {
  id: number;
  name: string;
  description: string | null;
  variants: VariantResponse[];
}

function groupRowsIntoProducts(rows: CatalogRow[]): ProductResponse[] {
  const map = new Map<number, ProductResponse>();
  for (const row of rows) {
    if (!map.has(row.product_id)) {
      map.set(row.product_id, {
        id: row.product_id,
        name: row.product_name,
        description: row.product_description,
        variants: [],
      });
    }
    if (row.variant_id !== null) {
      map.get(row.product_id)!.variants.push({
        id: row.variant_id,
        size: row.variant_size!,
        color: row.variant_color!,
        retailPrice: Number(row.variant_retail_price),
        stock: { quantity: row.stock_quantity ?? 0 },
      });
    }
  }
  return Array.from(map.values());
}

interface CreateProductDTO {
  name: string;
  description?: string;
}

interface CreateVariantDTO {
  size: string;
  color: string;
  retailPrice: number;
  initialStock: number;
}

export async function createProduct(dto: CreateProductDTO) {
  if (!dto.name?.trim()) {
    throw new AppError(400, 'Nombre requerido', 'https://jedami.com/errors/validation', 'El campo name es obligatorio');
  }
  const product = await productsRepository.createProduct(dto.name.trim(), dto.description);
  return { id: product.id, name: product.name, description: product.description };
}

export async function createVariant(productId: number, dto: CreateVariantDTO) {
  if (!dto.size || !dto.color || dto.retailPrice == null || dto.initialStock == null) {
    throw new AppError(400, 'Datos de variante incompletos', 'https://jedami.com/errors/validation', 'Faltan campos requeridos: size, color, retailPrice, initialStock');
  }
  if (dto.retailPrice < 0 || dto.initialStock < 0) {
    throw new AppError(400, 'Valores inválidos', 'https://jedami.com/errors/validation', 'retailPrice e initialStock deben ser >= 0');
  }

  const product = await productsRepository.findById(productId);
  if (!product) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${productId}`);
  }

  const { variant, stock } = await productsRepository.createVariantWithStock(
    productId, dto.size, dto.color, dto.retailPrice, dto.initialStock,
  );

  return {
    id: variant.id,
    productId: variant.product_id,
    size: variant.size,
    color: variant.color,
    retailPrice: Number(variant.retail_price),
    stock: { quantity: stock.quantity },
  };
}

export async function updateProduct(id: number, dto: { name?: string; description?: string | null }) {
  const existing = await productsRepository.findById(id);
  if (!existing) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${id}`);
  }
  // Si description no viene en el body (undefined), conservar el valor actual.
  // Si viene explícitamente como null o string vacío, limpiarlo.
  const description = dto.description === undefined ? existing.description : (dto.description ?? null);
  const updated = await productsRepository.updateProduct(id, { name: dto.name, description });
  return { id: updated!.id, name: updated!.name, description: updated!.description };
}

export async function findById(id: number) {
  const product = await productsRepository.findById(id);
  if (!product) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${id}`);
  }
  return { id: product.id, name: product.name, description: product.description };
}

export async function getCatalog(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    productsRepository.findAllWithVariants(pageSize, offset),
    productsRepository.countProducts(),
  ]);
  return { products: groupRowsIntoProducts(rows), total };
}

export async function getProductWithVariants(id: number): Promise<ProductResponse> {
  const rows = await productsRepository.findByIdWithVariants(id);
  if (rows.length === 0) {
    throw new AppError(404, 'Producto no encontrado', 'https://jedami.com/errors/product-not-found', `No existe producto con id ${id}`);
  }
  return groupRowsIntoProducts(rows)[0];
}
