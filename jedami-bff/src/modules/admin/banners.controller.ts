import { Request, Response, NextFunction } from 'express';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { pool } from '../../config/database.js';
import { UPLOADS_BANNERS_DIR } from '../../config/upload.js';
import { AppError } from '../../types/app-error.js';

function buildBannerUrl(imageUrl: string): string {
  // URLs externas (seeds) o paths absolutos se devuelven tal cual
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
  return `/uploads/banners/${imageUrl}`;
}

// ─── GET /config/banners (público — solo activos) ────────────────────────────

export async function getBanners(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT id, image_url, link_url, sort_order FROM banners WHERE active = TRUE ORDER BY sort_order ASC',
    );
    res.status(200).json({
      data: result.rows.map(r => ({
        id:        r.id,
        imageUrl:  buildBannerUrl(r.image_url),
        linkUrl:   r.link_url ?? null,
        sortOrder: r.sort_order,
      })),
    });
  } catch (err) { next(err); }
}

// ─── GET /admin/banners (admin — todos, incluye inactivos) ───────────────────

export async function getAllBanners(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT id, image_url, link_url, sort_order, active FROM banners ORDER BY sort_order ASC',
    );
    res.status(200).json({
      data: result.rows.map(r => ({
        id:        r.id,
        imageUrl:  buildBannerUrl(r.image_url),
        linkUrl:   r.link_url ?? null,
        sortOrder: r.sort_order,
        active:    r.active,
      })),
    });
  } catch (err) { next(err); }
}

// ─── POST /admin/banners ──────────────────────────────────────────────────────

export async function uploadBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      next(new AppError(400, 'Imagen requerida', 'https://jedami.com/errors/validation', 'Debe enviar un archivo de imagen'));
      return;
    }

    const { linkUrl } = req.body;

    const sortRes = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM banners');
    const sortOrder = Number(sortRes.rows[0].next);

    const result = await pool.query(
      'INSERT INTO banners (image_url, link_url, sort_order) VALUES ($1, $2, $3) RETURNING id, image_url, link_url, sort_order, active',
      [req.file.filename, linkUrl ?? null, sortOrder],
    );
    const b = result.rows[0];

    res.status(201).json({
      data: {
        id:        b.id,
        imageUrl:  buildBannerUrl(b.image_url),
        linkUrl:   b.link_url ?? null,
        sortOrder: b.sort_order,
        active:    b.active,
      },
    });
  } catch (err) { next(err); }
}

// ─── PATCH /admin/banners/reorder ────────────────────────────────────────────

export async function reorderBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
  const items: { id: number; sortOrder: number }[] = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    next(new AppError(400, 'Body inválido', 'https://jedami.com/errors/validation', 'El body debe ser un array no vacío de { id, sortOrder }'));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query('UPDATE banners SET sort_order = $1 WHERE id = $2', [item.sortOrder, item.id]);
    }
    await client.query('COMMIT');
    res.status(200).json({ data: { reordered: true } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// ─── PATCH /admin/banners/:id ─────────────────────────────────────────────────

export async function updateBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id debe ser un número'));
      return;
    }

    const { active, linkUrl } = req.body;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (active !== undefined) { fields.push(`active = $${idx++}`); values.push(active); }
    if (linkUrl !== undefined) { fields.push(`link_url = $${idx++}`); values.push(linkUrl ?? null); }

    if (fields.length === 0) {
      next(new AppError(400, 'Sin campos', 'https://jedami.com/errors/validation', 'Debe enviar al menos un campo para actualizar'));
      return;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE banners SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, image_url, link_url, sort_order, active`,
      values,
    );

    if (result.rowCount === 0) {
      next(new AppError(404, 'Banner no encontrado', 'https://jedami.com/errors/not-found', `No existe banner con id ${id}`));
      return;
    }

    const b = result.rows[0];
    res.status(200).json({
      data: {
        id:        b.id,
        imageUrl:  buildBannerUrl(b.image_url),
        linkUrl:   b.link_url ?? null,
        sortOrder: b.sort_order,
        active:    b.active,
      },
    });
  } catch (err) { next(err); }
}

// ─── DELETE /admin/banners/:id ────────────────────────────────────────────────

export async function deleteBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id debe ser un número'));
      return;
    }

    const result = await pool.query('DELETE FROM banners WHERE id = $1 RETURNING image_url', [id]);

    if (result.rowCount === 0) {
      next(new AppError(404, 'Banner no encontrado', 'https://jedami.com/errors/not-found', `No existe banner con id ${id}`));
      return;
    }

    const filename = result.rows[0].image_url;
    try {
      await unlink(join(UPLOADS_BANNERS_DIR, filename));
    } catch {
      // ignorar si el archivo ya no existe en disco
    }

    res.status(204).send();
  } catch (err) { next(err); }
}
