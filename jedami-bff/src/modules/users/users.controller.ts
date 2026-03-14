import { Request, Response, NextFunction } from 'express';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import * as customersRepository from '../customers/customers.repository.js';
import * as usersRepository from './users.repository.js';

export const listUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await usersRepository.findAll();
    res.json({
      data: users.map(u => ({
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        roles: u.roles ?? [],
      })),
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jwtUser = req.user as JwtUserPayload;
    // Leer roles y customer desde DB para reflejar cambios post-login
    const [dbUser, customer] = await Promise.all([
      usersRepository.findByIdWithRoles(jwtUser.id),
      customersRepository.findByUserId(jwtUser.id),
    ]);
    res.json({
      data: {
        id: jwtUser.id,
        email: jwtUser.email,
        roles: dbUser?.roles ?? [],
        customer: customer
          ? { id: customer.id, customerType: customer.customer_type }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};
