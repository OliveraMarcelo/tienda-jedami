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
  search?: string | null,
): Promise<CatalogRow[]> => {
  const result = await pool.query(FIND_ALL_WITH_VARIANTS, [pageSize, offset, categoryId ?? null, search ?? null]);
  return result.rows;
};

export const countProducts = async (categoryId?: number | null, search?: string | null): Promise<number> => {
  const result = await pool.query(COUNT_PRODUCTS, [categoryId ?? null, search ?? null]);
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
    'UPDATE variants SET active = FALSE WHERE id = $1 AND product_id = $2 AND active = TRUE',
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
    // Si existe una variante inactiva con la misma combinación, la reactiva en lugar de insertar
    const existingResult = await client.query(
      'SELECT id, product_id, size_id, color_id FROM variants WHERE product_id = $1 AND size_id = $2 AND color_id = $3 AND active = FALSE LIMIT 1',
      [productId, sizeId, colorId],
    );
    let variant: Variant;
    if (existingResult.rows.length > 0) {
      const reactivated = await client.query(
        'UPDATE variants SET active = TRUE WHERE id = $1 RETURNING id, product_id, size_id, color_id',
        [existingResult.rows[0].id],
      );
      variant = reactivated.rows[0];
      // Asegura que exista registro de stock (puede haberse eliminado en cascada)
      await client.query(
        'INSERT INTO stock (variant_id, quantity) VALUES ($1, $2) ON CONFLICT (variant_id) DO UPDATE SET quantity = EXCLUDED.quantity',
        [variant.id, initialStock],
      );
    } else {
      const variantResult = await client.query(CREATE_VARIANT, [productId, sizeId, colorId]);
      variant = variantResult.rows[0];
      await client.query(CREATE_STOCK, [variant.id, initialStock]);
    }
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

export const insertSize = async (label: string, sortOrder: number): Promise<Size> => {
  const result = await pool.query(
    'INSERT INTO sizes (label, sort_order) VALUES ($1, $2) RETURNING id, label, sort_order',
    [label, sortOrder],
  );
  return result.rows[0];
};

export const removeSize = async (id: number): Promise<void> => {
  await pool.query('DELETE FROM sizes WHERE id = $1', [id]);
};

export const insertColor = async (name: string, hexCode: string | null): Promise<Color> => {
  const result = await pool.query(
    'INSERT INTO colors (name, hex_code) VALUES ($1, $2) RETURNING id, name, hex_code',
    [name, hexCode],
  );
  return result.rows[0];
};

export const removeColor = async (id: number): Promise<void> => {
  await pool.query('DELETE FROM colors WHERE id = $1', [id]);
};

export const findSizeById = async (id: number): Promise<Size | null> => {
  const result = await pool.query('SELECT id, label, sort_order FROM sizes WHERE id = $1', [id]);
  return result.rows[0] ?? null;
};

export const findColorById = async (id: number): Promise<Color | null> => {
  const result = await pool.query('SELECT id, name, hex_code FROM colors WHERE id = $1', [id]);
  return result.rows[0] ?? null;
};

export const updateSizeActive = async (id: number, active: boolean): Promise<Size | null> => {
  const result = await pool.query(
    'UPDATE sizes SET active = $2 WHERE id = $1 RETURNING id, label, sort_order, active',
    [id, active],
  );
  return result.rows[0] ?? null;
};

export const updateColorActive = async (id: number, active: boolean): Promise<Color | null> => {
  const result = await pool.query(
    'UPDATE colors SET active = $2 WHERE id = $1 RETURNING id, name, hex_code, active',
    [id, active],
  );
  return result.rows[0] ?? null;
};

export const reorderImages = async (productId: number, items: { id: number; position: number }[]): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ids = items.map(i => i.id);
    const check = await client.query(
      'SELECT id FROM product_images WHERE product_id = $1 AND id = ANY($2::int[])',
      [productId, ids],
    );
    if (check.rows.length !== ids.length) {
      throw Object.assign(new Error('IDs de imágenes inválidos para este producto'), { _invalidIds: true });
    }
    for (const item of items) {
      await client.query('UPDATE product_images SET position = $1 WHERE id = $2', [item.position, item.id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
