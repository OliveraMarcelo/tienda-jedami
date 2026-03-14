import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import * as categoriesService from './categories.service.js';

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await categoriesService.listCategories();
    res.status(200).json({ data: categories });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name } = req.body;
    const category = await categoriesService.createCategory(name);
    res.status(201).json({ data: category });
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id debe ser un entero positivo'));
      return;
    }
    const { name } = req.body;
    const category = await categoriesService.updateCategory(id, name);
    res.status(200).json({ data: category });
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id debe ser un entero positivo'));
      return;
    }
    await categoriesService.deleteCategory(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
