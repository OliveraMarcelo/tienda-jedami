import { pool } from '../../config/database.js';
import { AppError } from '../../types/app-error.js';
import * as rolesRepository from './roles.repository.js';
import * as usersRepository from '../users/users.repository.js';

export async function assignRoleToUser(userId: number, roleId: number): Promise<{ userId: number; roleId: number }> {
  const user = await usersRepository.findById(userId);
  if (!user) {
    throw new AppError(404, 'Usuario no encontrado', 'https://jedami.com/errors/user-not-found', `No existe usuario con id ${userId}`);
  }

  const role = await rolesRepository.findById(roleId);
  if (!role) {
    throw new AppError(404, 'Rol no encontrado', 'https://jedami.com/errors/role-not-found', `No existe rol con id ${roleId}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, roleId],
    );

    if (role.name === 'wholesale' || role.name === 'retail') {
      await client.query(
        'UPDATE customers SET customer_type = $1 WHERE user_id = $2',
        [role.name, userId],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { userId, roleId };
}
