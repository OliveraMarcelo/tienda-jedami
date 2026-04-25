import { Request, Response, NextFunction } from 'express';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { pool } from '../../config/database.js';
import { UPLOADS_ANNOUNCEMENTS_DIR } from '../../config/upload.js';
import { AppError } from '../../types/app-error.js';

type Audience = 'all' | 'authenticated' | 'wholesale' | 'retail';

function buildAnnouncementUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  // URLs externas o absolutas se devuelven tal cual
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
  return `/uploads/announcements/${imageUrl}`;
}

function mapRow(r: Record<string, unknown>) {
  return {
    id:             r.id,
    title:          r.title,
    body:           r.body ?? null,
    imageUrl:       buildAnnouncementUrl(r.image_url as string | null),
    linkUrl:        r.link_url ?? null,
    linkLabel:      r.link_label ?? null,
    targetAudience: r.target_audience,
    active:         r.active,
    validFrom:      r.valid_from ?? null,
    validUntil:     r.valid_until ?? null,
    sortOrder:      r.sort_order,
  };
}

// ─── GET /config/announcements?audience=all|wholesale|retail (público) ────────

export async function getAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audience = (req.query.audience as string) ?? 'all';
    const validAudiences: Audience[] = ['all', 'wholesale', 'retail'];
    const normalizedAudience: Audience = validAudiences.includes(audience as Audience)
      ? (audience as Audience)
      : 'all';

    const result = await pool.query(
      `SELECT id, title, body, image_url, link_url, link_label, target_audience, sort_order
       FROM announcements
       WHERE active = TRUE
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_until IS NULL OR valid_until >= NOW())
         AND (
           target_audience = 'all'
           OR target_audience = $1
           OR ($1 != 'all' AND target_audience = 'authenticated')
         )
       ORDER BY sort_order ASC`,
      [normalizedAudience],
    );

    res.status(200).json({
      data: result.rows.map(r => ({
        id:        r.id,
        title:     r.title,
        body:      r.body ?? null,
        imageUrl:  buildAnnouncementUrl(r.image_url as string | null),
        linkUrl:   r.link_url ?? null,
        linkLabel: r.link_label ?? null,
        sortOrder: r.sort_order,
      })),
    });
  } catch (err) { next(err); }
}

// ─── GET /admin/announcements (admin — todos) ─────────────────────────────────

export async function getAllAnnouncements(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT id, title, body, image_url, link_url, link_label, target_audience,
              active, valid_from, valid_until, sort_order
       FROM announcements
       ORDER BY sort_order ASC`,
    );
    res.status(200).json({ data: result.rows.map(mapRow) });
  } catch (err) { next(err); }
}

// ─── POST /admin/announcements ────────────────────────────────────────────────

export async function createAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, body, linkUrl, linkLabel, targetAudience, validFrom, validUntil } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      next(new AppError(400, 'Título requerido', 'https://jedami.com/errors/validation', 'El campo title es obligatorio'));
      return;
    }

    const validAudiences: Audience[] = ['all', 'authenticated', 'wholesale', 'retail'];
    const audience: Audience = validAudiences.includes(targetAudience) ? targetAudience : 'all';

    // Imagen: si se subió un archivo, guardamos el filename; si no, NULL
    const imageUrl: string | null = req.file ? req.file.filename : null;

    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      const sortRes = await client.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM announcements');
      const sortOrder = Number(sortRes.rows[0].next);
      result = await client.query(
        `INSERT INTO announcements (title, body, image_url, link_url, link_label, target_audience, valid_from, valid_until, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, title, body, image_url, link_url, link_label, target_audience, active, valid_from, valid_until, sort_order`,
        [
          title.trim(),
          body ?? null,
          imageUrl,
          linkUrl ?? null,
          linkLabel ?? null,
          audience,
          validFrom ?? null,
          validUntil ?? null,
          sortOrder,
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
      return;
    } finally {
      client.release();
    }

    res.status(201).json({ data: mapRow(result.rows[0]) });
  } catch (err) { next(err); }
}

// ─── PATCH /admin/announcements/reorder ──────────────────────────────────────

export async function reorderAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
  const items: { id: number; sortOrder: number }[] = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    next(new AppError(400, 'Body inválido', 'https://jedami.com/errors/validation', 'El body debe ser un array no vacío de { id, sortOrder }'));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query('UPDATE announcements SET sort_order = $1 WHERE id = $2', [item.sortOrder, item.id]);
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

// ─── PATCH /admin/announcements/:id ──────────────────────────────────────────

export async function updateAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id debe ser un número'));
      return;
    }

    const { active, linkUrl, linkLabel, title, body, targetAudience, validFrom, validUntil } = req.body;

    const validAudiences: Audience[] = ['all', 'authenticated', 'wholesale', 'retail'];
    if (targetAudience !== undefined && !validAudiences.includes(targetAudience)) {
      next(new AppError(400, 'Audiencia inválida', 'https://jedami.com/errors/validation', `target_audience debe ser uno de: ${validAudiences.join(', ')}`));
      return;
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (active !== undefined)        { fields.push(`active = $${idx++}`);          values.push(active); }
    if (title !== undefined)         { fields.push(`title = $${idx++}`);           values.push(title); }
    if (body !== undefined)          { fields.push(`body = $${idx++}`);            values.push(body ?? null); }
    if (linkUrl !== undefined)       { fields.push(`link_url = $${idx++}`);        values.push(linkUrl ?? null); }
    if (linkLabel !== undefined)     { fields.push(`link_label = $${idx++}`);      values.push(linkLabel ?? null); }
    if (targetAudience !== undefined){ fields.push(`target_audience = $${idx++}`); values.push(targetAudience); }
    if (validFrom !== undefined)     { fields.push(`valid_from = $${idx++}`);      values.push(validFrom ?? null); }
    if (validUntil !== undefined)    { fields.push(`valid_until = $${idx++}`);     values.push(validUntil ?? null); }

    if (fields.length === 0) {
      next(new AppError(400, 'Sin campos', 'https://jedami.com/errors/validation', 'Debe enviar al menos un campo para actualizar'));
      return;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE announcements SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, title, body, image_url, link_url, link_label, target_audience, active, valid_from, valid_until, sort_order`,
      values,
    );

    if (result.rowCount === 0) {
      next(new AppError(404, 'Anuncio no encontrado', 'https://jedami.com/errors/not-found', `No existe anuncio con id ${id}`));
      return;
    }

    res.status(200).json({ data: mapRow(result.rows[0]) });
  } catch (err) { next(err); }
}

// ─── DELETE /admin/announcements/:id ─────────────────────────────────────────

export async function deleteAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      next(new AppError(400, 'ID inválido', 'https://jedami.com/errors/validation', 'El id debe ser un número'));
      return;
    }

    const result = await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING image_url', [id]);

    if (result.rowCount === 0) {
      next(new AppError(404, 'Anuncio no encontrado', 'https://jedami.com/errors/not-found', `No existe anuncio con id ${id}`));
      return;
    }

    const filename = result.rows[0].image_url as string | null;
    // Solo intentar borrar si es un filename local (no una URL externa)
    if (filename && !filename.startsWith('http') && !filename.startsWith('/')) {
      try {
        await unlink(join(UPLOADS_ANNOUNCEMENTS_DIR, filename));
      } catch {
        // ignorar si el archivo ya no existe en disco
      }
    }

    res.status(204).send();
  } catch (err) { next(err); }
}
