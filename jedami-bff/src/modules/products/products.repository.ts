import { pool } from '../../config/database.js';
import { Product, Variant, Stock } from './products.entity.js';
import { CREATE_PRODUCT } from './queries/create-product.js';
import { FIND_PRODUCT_BY_ID } from './queries/find-product-by-id.js';
import { UPDATE_PRODUCT } from './queries/update-product.js';
import { CREATE_VARIANT } from './queries/create-variant.js';
import { CREATE_STOCK } from './queries/create-stock.js';
import { FIND_ALL_WITH_VARIANTS, COUNT_PRODUCTS } from './queries/find-all-with-variants.js';
import { FIND_PRODUCT_BY_ID_WITH_VARIANTS } from './queries/find-by-id-with-variants.js';

export const createProduct = async (name: string, description?: string): Promise<Product> => {
  const result = await pool.query(CREATE_PRODUCT, [name, description ?? null]);
  return result.rows[0];
};

export const findById = async (id: number): Promise<Product | null> => {
  const result = await pool.query(FIND_PRODUCT_BY_ID, [id]);
  return result.rows[0] ?? null;
};

export const updateProduct = async (id: number, data: { name?: string; description?: string }): Promise<Product | null> => {
  const result = await pool.query(UPDATE_PRODUCT, [id, data.name ?? null, data.description ?? null]);
  return result.rows[0] ?? null;
};

export type CatalogRow = {
  product_id: number;
  product_name: string;
  product_description: string | null;
  variant_id: number | null;
  variant_size: string | null;
  variant_color: string | null;
  variant_retail_price: string | null;
  stock_quantity: number | null;
};

export const findAllWithVariants = async (limit: number, offset: number): Promise<CatalogRow[]> => {
  const result = await pool.query(FIND_ALL_WITH_VARIANTS, [limit, offset]);
  return result.rows;
};

export const countProducts = async (): Promise<number> => {
  const result = await pool.query(COUNT_PRODUCTS);
  return result.rows[0].total;
};

export const findByIdWithVariants = async (id: number): Promise<CatalogRow[]> => {
  const result = await pool.query(FIND_PRODUCT_BY_ID_WITH_VARIANTS, [id]);
  return result.rows;
};

export const createVariantWithStock = async (
  productId: number,
  size: string,
  color: string,
  retailPrice: number,
  initialStock: number,
): Promise<{ variant: Variant; stock: Stock }> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const variantResult = await client.query(CREATE_VARIANT, [productId, size, color, retailPrice]);
    const variant: Variant = variantResult.rows[0];

    await client.query(CREATE_STOCK, [variant.id, initialStock]);

    await client.query('COMMIT');
    return { variant, stock: { variant_id: variant.id, quantity: initialStock } };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
