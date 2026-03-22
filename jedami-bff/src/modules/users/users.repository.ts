import { pool } from '../../config/database.js';
import { User } from './users.entity.js';
import { FIND_BY_EMAIL } from './queries/find-by-email.js';
import { FIND_BY_EMAIL_WITH_ROLES } from './queries/find-by-email-with-roles.js';
import { FIND_USER_BY_ID } from './queries/find-by-id.js';
import { CREATE_USER } from './queries/create-user.js';
import { FIND_ALL_WITH_ROLES } from './queries/find-all-with-roles.js';

export const findByEmail = async (email: string): Promise<User | null> => {
  const result = await pool.query(FIND_BY_EMAIL, [email]);
  return result.rows[0] ?? null;
};

export const findByEmailWithRoles = async (email: string): Promise<User | null> => {
  const result = await pool.query(FIND_BY_EMAIL_WITH_ROLES, [email]);
  if (result.rows.length === 0) return null;
  const first = result.rows[0];
  return {
    id: first.id,
    email: first.email,
    password_hash: first.password_hash,
    created_at: first.created_at,
    roles: result.rows.map((r: { role_name: string | null }) => r.role_name).filter((n): n is string => n !== null),
  };
};

export const create = async (email: string, passwordHash: string): Promise<User> => {
  const result = await pool.query(CREATE_USER, [email, passwordHash]);
  return result.rows[0];
};

export const findById = async (id: number): Promise<Pick<User, 'id' | 'email'> | null> => {
  const result = await pool.query(FIND_USER_BY_ID, [id]);
  return result.rows[0] ?? null;
};

export const findByIdWithRoles = async (id: number): Promise<User | null> => {
  const result = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.created_at, r.name AS role_name
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1`,
    [id],
  );
  if (result.rows.length === 0) return null;
  const first = result.rows[0];
  return {
    id: first.id,
    email: first.email,
    password_hash: first.password_hash,
    created_at: first.created_at,
    roles: result.rows.map((r: { role_name: string | null }) => r.role_name).filter((n): n is string => n != null),
  };
};

export const findAll = async (): Promise<Pick<User, 'id' | 'email' | 'created_at' | 'roles'>[]> => {
  const result = await pool.query(FIND_ALL_WITH_ROLES);
  return result.rows;
};

export const assignRole = async (userId: number, roleId: number): Promise<void> => {
  await pool.query(
    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, roleId]
  );
};

export const removeRole = async (userId: number, roleId: number): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
    [userId, roleId],
  );
  return (result.rowCount ?? 0) > 0;
};
