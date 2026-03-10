import { ENV } from '../../config/env.js';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import { roleRepository } from '../roles/roles.repository.js';
import { User } from './users.entity.js';
import { userRepository } from './users.repository.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// si el usuario ya existe, validando por email, lanzar un error 
// si no, crear el usuario
interface CreateUserDTO {
  email: string;
  password: string;
}

export const createUser = async ({ email, password }: CreateUserDTO) => {
  const existingUser = await userRepository.findOne({ where: { email } });
  //Validaciones minimas 

  if (!email || !password) {
    throw new Error('Email y password son obligatorios');
  }

  if (existingUser) {
    throw new Error('Usuario ya existe');
  }

  const role = await roleRepository.findOne({ where: { name: 'minorista' } });
  if (!role) {
    throw new Error('Role por defecto no encontrado');
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const user = new User();
  user.email = email;
  user.passwordHash = passwordHash;
  user.roles = [role];
  return await userRepository.save(user);
}

export const loginUser = async (email: string, password: string) => {
  // Buscar el usuario por email
  const user = await userRepository.findOne({ where: { email }, relations: ['roles'] });
  // Validar si el usuario existe
  if (!user) {
    throw new Error('Credenciales invalidas');
  }
  // Validar la contraseña
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new Error('Credenciales invalidas');
  }
  const payload: JwtUserPayload = {
  id: user.id,
  email: user.email,
  roles: user.roles.map(r => r.name),
};
  const token = jwt.sign(
    payload,
    ENV.JWT_SECRET as jwt.Secret,
    { expiresIn: ENV.JWT_EXPIRES_IN } as jwt.SignOptions
  );
  delete (user as any).passwordHash;

  return { user, token };
};