import { pool } from '../../config/database.js';
import { Role } from './roles.entity.js';
import { FIND_ROLE_BY_NAME } from './queries/find-by-name.js';
import { FIND_ALL_ROLES } from './queries/find-all.js';
import { FIND_ROLE_BY_ID } from './queries/find-by-id.js';

export const findByName = async (name: string): Promise<Role | null> => {
  const result = await pool.query(FIND_ROLE_BY_NAME, [name]);
  return result.rows[0] ?? null;
};

export const findAll = async (): Promise<Role[]> => {
  const result = await pool.query(FIND_ALL_ROLES);
  return result.rows;
};

export const findById = async (id: number): Promise<Role | null> => {
  const result = await pool.query(FIND_ROLE_BY_ID, [id]);
  return result.rows[0] ?? null;
};
