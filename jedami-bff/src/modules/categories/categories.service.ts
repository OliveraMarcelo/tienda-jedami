import { AppError } from '../../types/app-error.js';
import * as categoriesRepository from './categories.repository.js';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function listCategories() {
  const categories = await categoriesRepository.findAll();
  return categories.map(c => ({ id: c.id, name: c.name, slug: c.slug }));
}

export async function createCategory(name: string) {
  if (!name?.trim()) {
    throw new AppError(400, 'Nombre requerido', 'https://jedami.com/errors/validation', 'El campo name es obligatorio');
  }
  const slug = toSlug(name.trim());
  const existing = await categoriesRepository.findBySlug(slug);
  if (existing) {
    throw new AppError(409, 'Categoría duplicada', 'https://jedami.com/errors/conflict', `Ya existe una categoría con slug "${slug}"`);
  }
  const category = await categoriesRepository.create(name.trim(), slug);
  return { id: category.id, name: category.name, slug: category.slug };
}

export async function updateCategory(id: number, name: string) {
  if (!name?.trim()) {
    throw new AppError(400, 'Nombre requerido', 'https://jedami.com/errors/validation', 'El campo name es obligatorio');
  }
  const existing = await categoriesRepository.findById(id);
  if (!existing) {
    throw new AppError(404, 'Categoría no encontrada', 'https://jedami.com/errors/not-found', `No existe categoría con id ${id}`);
  }
  const slug = toSlug(name.trim());
  const updated = await categoriesRepository.update(id, name.trim(), slug);
  return { id: updated!.id, name: updated!.name, slug: updated!.slug };
}

export async function deleteCategory(id: number) {
  const deleted = await categoriesRepository.remove(id);
  if (!deleted) {
    throw new AppError(404, 'Categoría no encontrada', 'https://jedami.com/errors/not-found', `No existe categoría con id ${id}`);
  }
}
