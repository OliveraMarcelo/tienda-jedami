import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import * as rolesRepository from './roles.repository.js';
import * as rolesService from './roles.service.js';

export async function listRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await rolesRepository.findAll();
    res.status(200).json({ data: roles });
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
