import { pool } from '../../config/database.js';
import { Product, Variant, Stock, ProductImage, Size, Color } from './products.entity.js';
import { CREATE_PRODUCT } from './queries/create-product.js';
import { FIND_PRODUCT_BY_ID } from './queries/find-product-by-id.js';
import { UPDATE_PRODUCT } from './queries/update-product.js';
import { CREATE_VARIANT } from './queries/create-variant.js';
import { CREATE_STOCK } from './queries/create-stock.js';
import { FIND_ALL_WITH_VARIANTS, COUNT_PRODUCTS } from './queries/find-all-with-variants.js';
import { FIND_PRODUCT_BY_ID_WITH_VARIANTS } from './queries/find-by-id-with-variants.js';
import { FIND_IMAGES_BY_PRODUCT } from './queries/find-images-by-product.js';
import { FIND_VARIANT_BY_ID } from './queries/update-variant.js';
import { FIND_ALL_SIZES, FIND_ALL_COLORS } from './queries/find-sizes-colors.js';
import { UPSERT_PRODUCT_PRICE } from './queries/product-prices.js';

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
  product_retail_price: string | null;
  product_wholesale_price: string | null;
  variant_id: number | null;
  variant_size_id: number | null;
  variant_size: string | null;
  variant_color_id: number | null;
  variant_color: string | null;
  variant_color_hex: string | null;
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

export type VariantWithJoins = {
  id: number;
  product_id: number;
  size_id: number;
  size: string;
  color_id: number;
  color: string;
  hex_code: string | null;
};

export const findVariantById = async (variantId: number): Promise<VariantWithJoins | null> => {
  const result = await pool.query(FIND_VARIANT_BY_ID, [variantId]);
  return result.rows[0] ?? null;
};

export const deleteProduct = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};

export const deleteVariant = async (variantId: number, productId: number): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM variants WHERE id = $1 AND product_id = $2',
    [variantId, productId],
  );
  return (result.rowCount ?? 0) > 0;
};

export const updateStock = async (variantId: number, quantity: number): Promise<void> => {
  await pool.query(
    'UPDATE stock SET quantity = $1 WHERE variant_id = $2',
    [quantity, variantId],
  );
};

export const createVariantWithStock = async (
  productId: number,
  sizeId: number,
  colorId: number,
  initialStock: number,
): Promise<{ variant: Variant; stock: Stock }> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const variantResult = await client.query(CREATE_VARIANT, [productId, sizeId, colorId]);
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

export const getSizes = async (): Promise<Size[]> => {
  const result = await pool.query(FIND_ALL_SIZES);
  return result.rows;
};

export const getColors = async (): Promise<Color[]> => {
  const result = await pool.query(FIND_ALL_COLORS);
  return result.rows;
};

export const findSizeById = async (id: number): Promise<Size | null> => {
  const result = await pool.query('SELECT id, label, sort_order FROM sizes WHERE id = $1', [id]);
  return result.rows[0] ?? null;
};

export const findColorById = async (id: number): Promise<Color | null> => {
  const result = await pool.query('SELECT id, name, hex_code FROM colors WHERE id = $1', [id]);
  return result.rows[0] ?? null;
};

export const upsertProductPrice = async (productId: number, modeCode: string, price: number): Promise<void> => {
  await pool.query(UPSERT_PRODUCT_PRICE, [productId, price, modeCode]);
};

export const deleteProductPrice = async (productId: number, modeCode: string): Promise<void> => {
  await pool.query(
    `DELETE FROM product_prices pp
     USING price_modes pm
     WHERE pp.price_mode_id = pm.id AND pm.code = $1 AND pp.product_id = $2`,
    [modeCode, productId],
  );
};
