import { Request, Response, NextFunction } from 'express';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import { AppError } from '../../types/app-error.js';
import * as rolesRepository from './roles.repository.js';
import * as rolesService from './roles.service.js';
import * as usersRepository from '../users/users.repository.js';

export async function listRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await rolesRepository.findAll();
    res.status(200).json({ data: roles });
  } catch (err) {
    next(err);
  }
}

export async function removeRoleFromUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestingUser = req.user as JwtUserPayload;
    const targetUserId = parseInt(req.params.userId, 10);
    const roleId = parseInt(req.params.roleId, 10);

    if (isNaN(targetUserId) || targetUserId <= 0 || isNaN(roleId) || roleId <= 0) {
      next(new AppError(400, 'Datos inválidos', 'https://jedami.com/errors/validation', 'userId y roleId deben ser enteros positivos'));
      return;
    }

    // Verificar que el rol existe
    const role = await rolesRepository.findById(roleId);
    if (!role) {
      next(new AppError(404, 'Rol no encontrado', 'https://jedami.com/errors/not-found', `No existe rol con id ${roleId}`));
      return;
    }

    // Prevenir self-demotion del rol admin
    if (requestingUser.id === targetUserId && role.name === 'admin') {
      next(new AppError(403, 'Operación no permitida', 'https://jedami.com/errors/forbidden', 'No podés remover tu propio rol admin'));
      return;
    }

    const removed = await usersRepository.removeRole(targetUserId, roleId);
    if (!removed) {
      next(new AppError(404, 'Rol no asignado', 'https://jedami.com/errors/not-found', 'El usuario no tiene ese rol'));
      return;
    }

    const updatedUser = await usersRepository.findByIdWithRoles(targetUserId);
    res.status(200).json({
      data: {
        id: updatedUser?.id,
        email: updatedUser?.email,
        roles: updatedUser?.roles ?? [],
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = parseInt(req.params.userId, 10);
    const roleId = parseInt(String(req.body.roleId), 10);

    if (isNaN(userId) || userId <= 0 || isNaN(roleId) || roleId <= 0) {
      next(new AppError(400, 'Datos inválidos', 'https://jedami.com/errors/validation', 'userId y roleId deben ser enteros positivos'));
      return;
    }

    const result = await rolesService.assignRoleToUser(userId, roleId);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}
