import { pool } from '../../config/database.js';
import { Product, Variant, Stock, ProductImage } from './products.entity.js';
import { CREATE_PRODUCT } from './queries/create-product.js';
import { FIND_PRODUCT_BY_ID } from './queries/find-product-by-id.js';
import { UPDATE_PRODUCT } from './queries/update-product.js';
import { CREATE_VARIANT } from './queries/create-variant.js';
import { CREATE_STOCK } from './queries/create-stock.js';
import { FIND_ALL_WITH_VARIANTS, COUNT_PRODUCTS } from './queries/find-all-with-variants.js';
import { FIND_PRODUCT_BY_ID_WITH_VARIANTS } from './queries/find-by-id-with-variants.js';
import { FIND_IMAGES_BY_PRODUCT } from './queries/find-images-by-product.js';
import { UPDATE_VARIANT, FIND_VARIANT_BY_ID } from './queries/update-variant.js';

export const createProduct = async (name: string, description?: string, categoryId?: number | null): Promise<Product> => {
  const result = await pool.query(CREATE_PRODUCT, [name, description ?? null, categoryId ?? null]);
  return result.rows[0];
};

export const findById = async (id: number): Promise<Product | null> => {
  const result = await pool.query(FIND_PRODUCT_BY_ID, [id]);
  return result.rows[0] ?? null;
};

export const updateProduct = async (
  id: number,
  data: { name?: string; description?: string | null; categoryId?: number | null },
): Promise<Product | null> => {
  const result = await pool.query(UPDATE_PRODUCT, [
    id,
    data.name ?? null,
    data.description ?? null,
    data.categoryId !== undefined ? data.categoryId : null,
  ]);
  return result.rows[0] ?? null;
};

export type CatalogRow = {
  product_id: number;
  product_name: string;
  product_description: string | null;
  product_category_id: number | null;
  product_category_name: string | null;
  image_url: string | null;
  variant_id: number | null;
  variant_size: string | null;
  variant_color: string | null;
  variant_retail_price: string | null;
  variant_wholesale_price: string | null;
  stock_quantity: number | null;
};

export const findAllWithVariants = async (
  pageSize: number,
  offset: number,
  categoryId?: number | null,
): Promise<CatalogRow[]> => {
  const result = await pool.query(FIND_ALL_WITH_VARIANTS, [pageSize, offset, categoryId ?? null]);
  return result.rows;
};

export const countProducts = async (categoryId?: number | null): Promise<number> => {
  const result = await pool.query(COUNT_PRODUCTS, [categoryId ?? null]);
  return result.rows[0].total;
};

export const findByIdWithVariants = async (id: number): Promise<CatalogRow[]> => {
  const result = await pool.query(FIND_PRODUCT_BY_ID_WITH_VARIANTS, [id]);
  return result.rows;
};

export const findImagesByProductId = async (productId: number): Promise<ProductImage[]> => {
  const result = await pool.query(FIND_IMAGES_BY_PRODUCT, [productId]);
  return result.rows;
};

export const addImage = async (productId: number, url: string, position: number): Promise<ProductImage> => {
  const result = await pool.query(
    'INSERT INTO product_images (product_id, url, position) VALUES ($1, $2, $3) RETURNING *',
    [productId, url, position],
  );
  return result.rows[0];
};

export const deleteImage = async (imageId: number, productId: number): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM product_images WHERE id = $1 AND product_id = $2',
    [imageId, productId],
  );
  return (result.rowCount ?? 0) > 0;
};

export const findVariantById = async (variantId: number): Promise<Variant | null> => {
  const result = await pool.query(FIND_VARIANT_BY_ID, [variantId]);
  return result.rows[0] ?? null;
};

export const updateVariant = async (
  variantId: number,
  productId: number,
  data: { retailPrice?: number; wholesalePrice?: number | null },
): Promise<Variant | null> => {
  const result = await pool.query(UPDATE_VARIANT, [
    variantId,
    data.retailPrice ?? null,
    data.wholesalePrice !== undefined ? data.wholesalePrice : null,
    productId,
  ]);
  return result.rows[0] ?? null;
};

export const createVariantWithStock = async (
  productId: number,
  size: string,
  color: string,
  retailPrice: number,
  initialStock: number,
  wholesalePrice?: number | null,
): Promise<{ variant: Variant; stock: Stock }> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const variantResult = await client.query(CREATE_VARIANT, [
      productId,
      size,
      color,
      retailPrice,
      wholesalePrice ?? null,
    ]);
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
