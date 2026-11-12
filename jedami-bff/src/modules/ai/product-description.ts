import type { ChatMessage } from '../../lib/ai.js';
import { redactSensitive } from '../../lib/ai-guard.js';

// Lógica pura del generador de descripciones (sin DB ni red): prompt, normalización
// de la respuesta y armado del dataset para fine-tuning. Exportada para tests.

export const PRODUCT_DESCRIPTION_TASK = 'product_description';

export interface ProductDescriptionInput {
  name: string;
  categoryName?: string | null;
  sizes?: string[];
  colors?: string[];
  notes?: string | null;
  productId?: number | null;
}

export interface ProductDescriptionOutput {
  title: string | null;
  description: string;
  highlights: string[];
}

// Corto y genérico a propósito: el tono fino de la marca vive en el Modelfile
// (ai/Modelfile.jedami-descripciones). Así sirve igual con un modelo pago.
export const PRODUCT_DESCRIPTION_SYSTEM = [
  'Sos redactor de una tienda online argentina de ropa infantil que vende por mayor y por menor.',
  'Escribís en español rioplatense (vos), con tono cálido, claro y sin exagerar.',
  'Usá SOLO los datos que te pasan: no inventes materiales, medidas, edades, precios ni cuidados que no estén en los datos.',
  'Respondé únicamente con un objeto JSON con esta forma:',
  '{"title": "título corto y atractivo", "description": "2 a 4 oraciones", "highlights": ["3 a 5 puntos breves"]}',
].join('\n');

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanList = (list: unknown, maxItems: number, maxLen: number) =>
  (Array.isArray(list) ? list : [])
    .map((x) => clean(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);

/** Normaliza lo que llega del admin (recorta, saca vacíos y duplicados). */
export function normalizeInput(raw: Record<string, unknown>): ProductDescriptionInput {
  const productId = Number(raw.productId);
  return {
    name: clean(raw.name, 120),
    categoryName: clean(raw.categoryName, 80) || null,
    sizes: [...new Set(cleanList(raw.sizes, 30, 20))],
    colors: [...new Set(cleanList(raw.colors, 30, 40))],
    // Texto libre: se borran emails, teléfonos, DNI/CUIT, tarjetas y links antes de enviarlo
    notes: redactSensitive(clean(raw.notes, 500)) || null,
    productId: Number.isInteger(productId) && productId > 0 ? productId : null,
  };
}

/** Datos del producto en texto, tal como los ve el modelo (también se usa en el dataset). */
export function buildUserPrompt(input: ProductDescriptionInput): string {
  const lines = [`Producto: ${input.name}`];
  if (input.categoryName) lines.push(`Categoría: ${input.categoryName}`);
  if (input.sizes?.length) lines.push(`Talles: ${input.sizes.join(', ')}`);
  if (input.colors?.length) lines.push(`Colores: ${input.colors.join(', ')}`);
  if (input.notes) lines.push(`Datos extra: ${input.notes}`);
  lines.push('', 'Escribí el título, la descripción y los puntos destacados en JSON.');
  return lines.join('\n');
}

export function buildMessages(input: ProductDescriptionInput): ChatMessage[] {
  return [
    { role: 'system', content: PRODUCT_DESCRIPTION_SYSTEM },
    { role: 'user', content: buildUserPrompt(input) },
  ];
}

/**
 * Convierte el JSON del modelo en una salida usable. Acepta variantes comunes
 * (descripcion, puntos, bullets…). Devuelve null si no hay descripción.
 */
export function normalizeOutput(obj: Record<string, unknown> | null): ProductDescriptionOutput | null {
  if (!obj) return null;
  const pick = (...keys: string[]) => keys.map((k) => obj[k]).find((v) => v !== undefined && v !== null);

  const description = clean(pick('description', 'descripcion', 'descripción', 'texto'), 1500);
  if (!description) return null;

  const rawHighlights = pick('highlights', 'puntos', 'destacados', 'bullets', 'features');
  const highlights = typeof rawHighlights === 'string'
    ? cleanList(rawHighlights.split(/\n|•|;/), 6, 140)
    : cleanList(rawHighlights, 6, 140);

  return {
    title: clean(pick('title', 'titulo', 'título'), 120) || null,
    description,
    highlights: highlights.map((h) => h.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean),
  };
}

/** Texto final para el campo "descripción" del producto: descripción + puntos con viñetas. */
export function composeDescriptionText(out: ProductDescriptionOutput): string {
  if (!out.highlights.length) return out.description;
  return `${out.description}\n\n${out.highlights.map((h) => `• ${h}`).join('\n')}`;
}

/** Inverso de composeDescriptionText: separa el texto editado en descripción y viñetas. */
export function splitDescriptionText(text: string): { description: string; highlights: string[] } {
  const lines = text.split('\n');
  const highlights = lines.filter((l) => /^\s*[•*-]\s+/.test(l)).map((l) => l.replace(/^\s*[•*-]\s+/, '').trim()).filter(Boolean);
  const description = lines.filter((l) => !/^\s*[•*-]\s+/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { description, highlights };
}

export interface GenerationRow {
  input: ProductDescriptionInput;
  output: ProductDescriptionOutput;
  final_text: string | null;
  status: string;
}

/**
 * Dataset para fine-tuning en formato chat (una línea JSON por ejemplo).
 * La respuesta del asistente es lo que el admin aprobó: si la editó, se usa su texto final.
 */
export function toFineTuneJsonl(rows: GenerationRow[]): string {
  return rows
    .filter((r) => r.status === 'accepted' || r.status === 'edited')
    .map((r) => {
      const assistant = r.status === 'edited' && r.final_text
        ? { title: r.output.title, ...splitDescriptionText(r.final_text) }
        : r.output;
      return JSON.stringify({
        messages: [
          { role: 'system', content: PRODUCT_DESCRIPTION_SYSTEM },
          { role: 'user', content: buildUserPrompt(r.input) },
          { role: 'assistant', content: JSON.stringify(assistant) },
        ],
      });
    })
    .join('\n');
}
