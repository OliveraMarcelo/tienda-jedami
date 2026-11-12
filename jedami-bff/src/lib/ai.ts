import { ENV } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../types/app-error.js';

// Cliente mínimo para cualquier API compatible con OpenAI (/chat/completions):
// Ollama local (http://localhost:11434/v1), OpenAI, Gemini en modo compatible, etc.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  model: string;
  durationMs: number;
}

export function isAiConfigured(): boolean {
  return Boolean(ENV.AI_BASE_URL);
}

const AI_ERROR_TYPE = 'https://jedami.com/errors/ai-unavailable';

/**
 * Pide una respuesta al modelo. Con `json: true` solicita un objeto JSON
 * (response_format json_object), que Ollama y OpenAI respetan.
 */
export async function chatCompletion(messages: ChatMessage[], opts: { json?: boolean; temperature?: number } = {}): Promise<ChatResult> {
  if (!isAiConfigured()) {
    throw new AppError(503, 'IA no configurada', AI_ERROR_TYPE, 'La generación con IA no está activada en este servidor');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENV.AI_TIMEOUT_MS);
  const startedAt = Date.now();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ENV.AI_API_KEY) headers.Authorization = `Bearer ${ENV.AI_API_KEY}`;

  let res: Response;
  try {
    res = await fetch(`${ENV.AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: ENV.AI_MODEL,
        messages,
        stream: false,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
  } catch (err) {
    const timedOut = (err as Error).name === 'AbortError';
    logger.warn({ err: (err as Error).message, timedOut, baseUrl: ENV.AI_BASE_URL }, '[AI] Sin respuesta del modelo');
    throw new AppError(
      timedOut ? 504 : 503,
      'IA no disponible',
      AI_ERROR_TYPE,
      timedOut
        ? 'El modelo tardó demasiado en responder. Probá de nuevo.'
        : 'No se pudo conectar con el modelo de IA. Revisá que esté encendido.',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.warn({ status: res.status, body: body.slice(0, 300) }, '[AI] Error del proveedor');
    throw new AppError(502, 'IA no disponible', AI_ERROR_TYPE, 'El modelo de IA devolvió un error. Probá de nuevo en un rato.');
  }

  const data = await res.json() as { model?: string; choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content.trim()) {
    throw new AppError(502, 'IA no disponible', AI_ERROR_TYPE, 'El modelo devolvió una respuesta vacía. Probá de nuevo.');
  }

  return { content, model: data.model ?? ENV.AI_MODEL, durationMs: Date.now() - startedAt };
}

/**
 * Extrae el primer objeto JSON de la respuesta del modelo.
 * Tolera bloques ```json, texto antes o después y comillas tipográficas en el borde.
 */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return tryParse(cleaned.slice(start, end + 1));
}
