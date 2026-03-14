export const FIND_IMAGES_BY_PRODUCT = `
  SELECT id, product_id, url, position, created_at
  FROM product_images
  WHERE product_id = $1
  ORDER BY position ASC, id ASC
`;
