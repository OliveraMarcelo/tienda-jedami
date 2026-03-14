import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import * as productsService from './products.service.js';
import { cacheGet, cacheSet, cacheDel } from '../../config/redis.js';
import { ENV } from '../../config/env.js';

const CATALOG_KEY = 'catalog:*';

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description } = req.body;
    const product = await productsService.createProduct({ name, description });
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
    const { size, color, retailPrice, initialStock } = req.body;
    const variant = await productsService.createVariant(productId, { size, color, retailPrice, initialStock });
    await cacheDel(CATALOG_KEY, `product:${productId}`);
    res.status(201).json({ data: variant });
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
    const { name, description } = req.body;
    const product = await productsService.updateProduct(id, { name, description });
    await cacheDel(CATALOG_KEY, `product:${id}`);
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
    const cacheKey = `product:${id}`;
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
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const cacheKey = `catalog:page:${page}:size:${pageSize}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(JSON.parse(cached));
      return;
    }

    const { products, total } = await productsService.getCatalog(page, pageSize);
    const body = { data: products, meta: { page, pageSize, total } };
    await cacheSet(cacheKey, JSON.stringify(body), ENV.CACHE_TTL);
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}
