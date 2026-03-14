import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import * as productsService from './products.service.js';
import { cacheGet, cacheSet, cacheDel } from '../../config/redis.js';
import { ENV } from '../../config/env.js';
import { uploadMiddleware } from '../../config/upload.js';

const CATALOG_KEY = 'catalog:*';
const PRODUCT_KEY = (id: number) => `product:${id}`;

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description, categoryId } = req.body;
    const product = await productsService.createProduct({ name, description, categoryId: categoryId ?? null });
    await cacheDel(CATALOG_KEY);
    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
}

export async function createVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseId(req.params.id);
    if (!productId) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del producto debe ser un entero positivo'));
      return;
    }
    const { size, color, retailPrice, initialStock, wholesalePrice } = req.body;
    const variant = await productsService.createVariant(productId, {
      size, color, retailPrice, initialStock, wholesalePrice: wholesalePrice ?? null,
    });
    await cacheDel(CATALOG_KEY, PRODUCT_KEY(productId));
    res.status(201).json({ data: variant });
  } catch (err) {
    next(err);
  }
}

export async function updateVariantHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseId(req.params.id);
    const variantId = parseId(req.params.variantId);
    if (!productId || !variantId) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'Los ids deben ser enteros positivos'));
      return;
    }
    const { retailPrice, wholesalePrice } = req.body;
    const variant = await productsService.updateVariant(productId, variantId, { retailPrice, wholesalePrice });
    await cacheDel(CATALOG_KEY, PRODUCT_KEY(productId));
    res.status(200).json({ data: variant });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del producto debe ser un entero positivo'));
      return;
    }
    const { name, description, categoryId } = req.body;
    const product = await productsService.updateProduct(id, { name, description, categoryId });
    await cacheDel(CATALOG_KEY, PRODUCT_KEY(id));
    res.status(200).json({ data: product });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del producto debe ser un entero positivo'));
      return;
    }
    const cacheKey = PRODUCT_KEY(id);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(JSON.parse(cached));
      return;
    }

    const product = await productsService.getProductWithVariants(id);
    const body = { data: product };
    await cacheSet(cacheKey, JSON.stringify(body), ENV.CACHE_TTL);
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawPage = parseInt(req.query.page as string);
    const rawPageSize = parseInt(req.query.pageSize as string);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const pageSize = Math.min(isNaN(rawPageSize) || rawPageSize < 1 ? 20 : rawPageSize, 100);

    const rawCategoryId = req.query.categoryId as string | undefined;
    const categoryId = rawCategoryId != null && rawCategoryId !== ''
      ? (parseInt(rawCategoryId, 10) || null)
      : null;

    const cacheKey = `catalog:page:${page}:size:${pageSize}:cat:${categoryId ?? 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(JSON.parse(cached));
      return;
    }

    const { products, total } = await productsService.getCatalog(page, pageSize, categoryId);
    const body = { data: products, meta: { page, pageSize, total, categoryId } };
    await cacheSet(cacheKey, JSON.stringify(body), ENV.CACHE_TTL);
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export function uploadImageHandler(req: Request, res: Response, next: NextFunction): void {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      next(new AppError(400, 'Upload inválido', 'https://jedami.com/errors/validation', err.message));
      return;
    }
    try {
      const productId = parseId(req.params.id);
      if (!productId) {
        next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id del producto debe ser un entero positivo'));
        return;
      }
      if (!req.file) {
        next(new AppError(400, 'Archivo requerido', 'https://jedami.com/errors/validation', 'Debe enviar un archivo de imagen (campo "image")'));
        return;
      }
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const url = `${baseUrl}/uploads/products/${req.file.filename}`;
      const position = req.body.position != null ? parseInt(req.body.position, 10) : undefined;
      const image = await productsService.addImage(productId, url, position);
      await cacheDel(CATALOG_KEY, PRODUCT_KEY(productId));
      res.status(201).json({ data: image });
    } catch (uploadErr) {
      next(uploadErr);
    }
  });
}

export async function deleteImageHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseId(req.params.id);
    const imageId = parseId(req.params.imageId);
    if (!productId || !imageId) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'Los ids deben ser enteros positivos'));
      return;
    }
    await productsService.deleteImage(productId, imageId);
    await cacheDel(CATALOG_KEY, PRODUCT_KEY(productId));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
