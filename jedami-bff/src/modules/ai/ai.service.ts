import { pool } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { AppError } from '../../types/app-error.js';
import { chatCompletion, isAiConfigured, parseJsonObject } from '../../lib/ai.js';
import {
  PRODUCT_DESCRIPTION_TASK,
  buildMessages,
  normalizeOutput,
  toFineTuneJsonl,
  type GenerationRow,
  type ProductDescriptionInput,
} from './product-description.js';

export const GENERATION_STATUSES = ['accepted', 'edited', 'discarded'] as const;
export type GenerationStatus = typeof GENERATION_STATUSES[number];

export function getAiStatus() {
  return { enabled: isAiConfigured(), model: isAiConfigured() ? ENV.AI_MODEL : null };
}

export async function generateProductDescription(input: ProductDescriptionInput, userId: number) {
  const messages = buildMessages(input);

  // Los modelos chicos a veces devuelven JSON roto: un reintento antes de rendirse
  let result = await chatCompletion(messages, { json: true });
  let output = normalizeOutput(parseJsonObject(result.content));
  if (!output) {
    result = await chatCompletion(messages, { json: true });
    output = normalizeOutput(parseJsonObject(result.content));
  }
  if (!output) {
    throw new AppError(502, 'Respuesta inválida', 'https://jedami.com/errors/ai-invalid-output', 'El modelo no devolvió una descripción usable. Probá regenerar.');
  }

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO ai_generations (task, product_id, model, input, output, duration_ms, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [PRODUCT_DESCRIPTION_TASK, input.productId ?? null, result.model, JSON.stringify(input), JSON.stringify(output), result.durationMs, userId],
  );

  return { generationId: rows[0].id, model: result.model, durationMs: result.durationMs, ...output };
}

export async function updateGeneration(id: number, status: GenerationStatus, finalText: string | null, productId: number | null) {
  const { rowCount } = await pool.query(
    `UPDATE ai_generations
     SET status = $2, final_text = $3, product_id = COALESCE($4, product_id), updated_at = NOW()
     WHERE id = $1`,
    [id, status, finalText, productId],
  );
  if (!rowCount) {
    throw new AppError(404, 'Generación no encontrada', 'https://jedami.com/errors/not-found', `No existe la generación ${id}`);
  }
}

export async function exportFineTuneDataset(): Promise<{ jsonl: string; count: number }> {
  const { rows } = await pool.query<GenerationRow>(
    `SELECT input, output, final_text, status
     FROM ai_generations
     WHERE task = $1 AND status IN ('accepted', 'edited')
     ORDER BY id`,
    [PRODUCT_DESCRIPTION_TASK],
  );
  const jsonl = toFineTuneJsonl(rows);
  return { jsonl, count: jsonl ? jsonl.split('\n').length : 0 };
}
