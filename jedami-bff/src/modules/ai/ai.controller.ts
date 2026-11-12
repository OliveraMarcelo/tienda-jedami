import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../types/app-error.js';
import { JwtUserPayload } from '../auth/jwt-payload.js';
import { normalizeInput } from './product-description.js';
import * as aiService from './ai.service.js';

const VALIDATION = 'https://jedami.com/errors/validation';

export function aiStatusHandler(_req: Request, res: Response): void {
  res.json({ data: aiService.getAiStatus() });
}

export async function generateProductDescriptionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = normalizeInput(req.body ?? {});
    if (input.name.length < 2) {
      next(new AppError(400, 'Datos incompletos', VALIDATION, 'Escribí el nombre del producto antes de generar la descripción'));
      return;
    }
    const user = req.user as JwtUserPayload;
    const result = await aiService.generateProductDescription(input, user.id);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateGenerationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      next(new AppError(400, 'ID inválido', VALIDATION, 'El ID de la generación no es válido'));
      return;
    }
    const { status, finalText, productId } = req.body ?? {};
    if (!aiService.GENERATION_STATUSES.includes(status)) {
      next(new AppError(400, 'Estado inválido', VALIDATION, `El estado debe ser uno de: ${aiService.GENERATION_STATUSES.join(', ')}`));
      return;
    }
    const text = typeof finalText === 'string' ? finalText.trim().slice(0, 5000) || null : null;
    const pid = Number(productId);
    await aiService.updateGeneration(id, status, text, Number.isInteger(pid) && pid > 0 ? pid : null);
    res.json({ data: { id, status } });
  } catch (err) {
    next(err);
  }
}

export async function exportGenerationsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { jsonl, count } = await aiService.exportFineTuneDataset();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jedami-descripciones-${date}.jsonl"`);
    res.setHeader('X-Examples-Count', String(count));
    res.send(jsonl ? `${jsonl}\n` : '');
  } catch (err) {
    next(err);
  }
}
