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
    const user = req.user as JwtUserPayload;
    const customer = await customersRepository.findByUserId(user.id);
    res.json({
      data: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        customer: customer
          ? { id: customer.id, customerType: customer.customer_type }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};
