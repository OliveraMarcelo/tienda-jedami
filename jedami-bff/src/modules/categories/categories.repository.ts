import { pool } from '../../config/database.js';
import { Category } from './categories.entity.js';

export const findAll = async (): Promise<Category[]> => {
  const result = await pool.query(
    'SELECT id, name, slug, created_at FROM categories ORDER BY name',
  );
  return result.rows;
};

export const findById = async (id: number): Promise<Category | null> => {
  const result = await pool.query(
    'SELECT id, name, slug, created_at FROM categories WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
};

export const findBySlug = async (slug: string): Promise<Category | null> => {
  const result = await pool.query(
    'SELECT id, name, slug, created_at FROM categories WHERE slug = $1',
    [slug],
  );
  return result.rows[0] ?? null;
};

export const create = async (name: string, slug: string): Promise<Category> => {
  const result = await pool.query(
    'INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING *',
    [name, slug],
  );
  return result.rows[0];
};

export const update = async (id: number, name: string, slug: string): Promise<Category | null> => {
  const result = await pool.query(
    'UPDATE categories SET name = $2, slug = $3 WHERE id = $1 RETURNING *',
    [id, name, slug],
  );
  return result.rows[0] ?? null;
};

export const remove = async (id: number): Promise<boolean> => {
  const result = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
};
