import { AppDataSource } from '../../config/typeorm.js';
import { User } from "./users.entity.js";


export const userRepository = AppDataSource.getRepository(User);
