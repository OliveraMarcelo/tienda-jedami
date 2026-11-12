import { describe, it, expect } from 'vitest';
import { parseJsonObject } from '../lib/ai.js';
import {
  normalizeInput,
  buildUserPrompt,
  buildMessages,
  normalizeOutput,
  composeDescriptionText,
  splitDescriptionText,
  toFineTuneJsonl,
  PRODUCT_DESCRIPTION_SYSTEM,
} from '../modules/ai/product-description.js';

describe('parseJsonObject', () => {
  it('parsea JSON directo', () => {
    expect(parseJsonObject('{"description":"Hola"}')).toEqual({ description: 'Hola' });
  });

  it('saca los bloques ```json y el texto alrededor', () => {
    const text = 'Acá va:\n```json\n{"title":"Kiki","description":"Lindo"}\n```\nEspero que sirva';
    expect(parseJsonObject(text)).toEqual({ title: 'Kiki', description: 'Lindo' });
  });

  it('devuelve null si no hay JSON válido o es un array', () => {
    expect(parseJsonObject('sin json')).toBeNull();
    expect(parseJsonObject('{roto')).toBeNull();
    expect(parseJsonObject('[1,2]')).toBeNull();
  });
});

describe('normalizeInput', () => {
  it('recorta, saca vacíos y duplicados', () => {
    const input = normalizeInput({
      name: '  Conjunto   kiki ',
      sizes: ['1', '2', '2', ' ', 3],
      colors: 'Rosa',
      notes: '',
      productId: 'abc',
    });
    expect(input).toEqual({
      name: 'Conjunto kiki',
      categoryName: null,
      sizes: ['1', '2', '3'],
      colors: [],
      notes: null,
      productId: null,
    });
  });
});

describe('prompt', () => {
  it('incluye solo los datos provistos', () => {
    const prompt = buildUserPrompt({ name: 'Enterito', colors: ['Gris'], sizes: [] });
    expect(prompt).toContain('Producto: Enterito');
    expect(prompt).toContain('Colores: Gris');
    expect(prompt).not.toContain('Talles');
    expect(prompt).not.toContain('Categoría');
  });

  it('arma system + user', () => {
    const msgs = buildMessages({ name: 'Pantalón' });
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user']);
    expect(msgs[0].content).toBe(PRODUCT_DESCRIPTION_SYSTEM);
    expect(msgs[0].content).toMatch(/no inventes/i);
  });
});

describe('normalizeOutput', () => {
  it('acepta claves en español y viñetas como texto', () => {
    const out = normalizeOutput({ titulo: 'Kiki', descripcion: 'Suave y cómodo.', puntos: '- Algodón\n- Capucha' });
    expect(out).toEqual({ title: 'Kiki', description: 'Suave y cómodo.', highlights: ['Algodón', 'Capucha'] });
  });

  it('devuelve null sin descripción', () => {
    expect(normalizeOutput({ title: 'x' })).toBeNull();
    expect(normalizeOutput(null)).toBeNull();
  });
});

describe('texto final', () => {
  it('compone y separa descripción + viñetas', () => {
    const text = composeDescriptionText({ title: null, description: 'Lindo conjunto.', highlights: ['Algodón', 'Capucha'] });
    expect(text).toBe('Lindo conjunto.\n\n• Algodón\n• Capucha');
    expect(splitDescriptionText(text)).toEqual({ description: 'Lindo conjunto.', highlights: ['Algodón', 'Capucha'] });
  });
});

describe('toFineTuneJsonl', () => {
  const input = { name: 'Conjunto kiki', sizes: ['1'], colors: ['Rosa'] };
  const output = { title: 'Kiki', description: 'Original', highlights: ['A'] };

  it('incluye aceptadas y editadas (con el texto final) y omite el resto', () => {
    const jsonl = toFineTuneJsonl([
      { input, output, final_text: null, status: 'accepted' },
      { input, output, final_text: 'Editado por el admin.\n\n• Algodón', status: 'edited' },
      { input, output, final_text: null, status: 'discarded' },
      { input, output, final_text: null, status: 'generated' },
    ]);
    const lines = jsonl.split('\n').map((l) => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[0].messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'assistant']);
    expect(JSON.parse(lines[0].messages[2].content)).toEqual(output);
    expect(JSON.parse(lines[1].messages[2].content)).toEqual({
      title: 'Kiki',
      description: 'Editado por el admin.',
      highlights: ['Algodón'],
    });
  });

  it('devuelve vacío sin ejemplos', () => {
    expect(toFineTuneJsonl([])).toBe('');
  });
});
