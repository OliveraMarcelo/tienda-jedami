import { DataSource } from 'typeorm';
import { ENV } from './env.js';
import { User } from '../modules/users/users.entity.js';
import { Role } from '../modules/roles/roles.entity.js';
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: ENV.DATABASE_URL,
  synchronize: false, // NUNCA en producción
  logging: false,
  entities: [User, Role],
});