import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import * as rolesRepository from './roles.repository.js';
import * as usersRepository from '../users/users.repository.js';
import * as customersRepository from '../customers/customers.repository.js';

export async function listRoles(_req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await rolesRepository.findAll();
    res.status(200).json({ data: roles });
  } catch (err) {
    next(err);
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.params.userId);
    const { roleId } = req.body;

    if (!userId || !roleId) {
      return next(new AppError(400, 'Datos incompletos', 'https://jedami.com/errors/validation', 'userId y roleId son obligatorios'));
    }

    const user = await usersRepository.findById(userId);
    if (!user) {
      return next(new AppError(404, 'Usuario no encontrado', 'https://jedami.com/errors/user-not-found', `No existe usuario con id ${userId}`));
    }

    const role = await rolesRepository.findById(Number(roleId));
    if (!role) {
      return next(new AppError(404, 'Rol no encontrado', 'https://jedami.com/errors/role-not-found', `No existe rol con id ${roleId}`));
    }

    await usersRepository.assignRole(userId, Number(roleId));

    // Si se asigna el rol wholesale, actualizar customer_type
    if (role.name === 'wholesale') {
      await customersRepository.updateCustomerType(userId, 'wholesale');
    } else if (role.name === 'retail') {
      await customersRepository.updateCustomerType(userId, 'retail');
    }

    res.status(200).json({ data: { userId, roleId: Number(roleId) } });
  } catch (err) {
    next(err);
  }
}
