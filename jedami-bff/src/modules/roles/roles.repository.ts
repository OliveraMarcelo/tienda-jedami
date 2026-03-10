import { AppDataSource } from '../../config/typeorm.js';
import { Role } from './roles.entity.js';

export const roleRepository = AppDataSource.getRepository(Role);
