import { describe, it, expect } from 'vitest';
import { aiProviderBlockReason, isPrivateAiHost, redactSensitive, REDACTED } from '../lib/ai-guard.js';
import { normalizeInput, buildUserPrompt } from '../modules/ai/product-description.js';

describe('isPrivateAiHost', () => {
  it.each([
    'http://localhost:11434/v1',
    'http://127.0.0.1:11434/v1',
    'http://[::1]:11434/v1',
    'http://192.168.1.20:11434/v1',
    'http://10.0.0.5:11434/v1',
    'http://172.20.0.3:11434/v1',
    'http://100.101.102.103:11434/v1',
    'http://mi-pc.tail1234.ts.net:11434/v1',
    'http://ollama:11434/v1',
    'http://host.docker.internal:11434/v1',
  ])('acepta %s', (url) => {
    expect(isPrivateAiHost(url)).toBe(true);
  });

  it.each([
    'https://api.openai.com/v1',
    'https://generativelanguage.googleapis.com/v1beta/openai',
    'http://8.8.8.8:11434/v1',
    'http://172.32.0.1/v1',
    'http://100.128.0.1/v1',
    'no es una url',
  ])('rechaza %s', (url) => {
    expect(isPrivateAiHost(url)).toBe(false);
  });
});

describe('aiProviderBlockReason', () => {
  it('permite un modelo local sin más configuración', () => {
    expect(aiProviderBlockReason('http://localhost:11434/v1', false)).toBeNull();
  });

  it('bloquea un proveedor externo si no se habilitó', () => {
    expect(aiProviderBlockReason('https://api.openai.com/v1', false)).toMatch(/AI_ALLOW_EXTERNAL_PROVIDER/);
  });

  it('permite un proveedor externo habilitado con https', () => {
    expect(aiProviderBlockReason('https://api.openai.com/v1', true)).toBeNull();
  });

  it('exige https a un proveedor externo', () => {
    expect(aiProviderBlockReason('http://api.ejemplo.com/v1', true)).toMatch(/HTTPS/);
  });
});

describe('redactSensitive', () => {
  it.each([
    ['escribime a ana.perez+tienda@gmail.com', 'ana.perez'],
    ['whatsapp +54 9 11 2345-6789', '2345-6789'],
    ['llamar al 011 4567-8901', '4567-8901'],
    ['DNI 30.123.456', '30.123.456'],
    ['DNI 30123456', '30123456'],
    ['CUIT 20-30123456-7', '30123456'],
    ['CBU 0170099220000067890123', '0170099220000067890123'],
    ['tarjeta 4509 9535 6623 3704', '4509'],
    ['ver https://proveedor.com/lista?x=1', 'proveedor.com'],
  ])('borra el dato de "%s"', (text, secret) => {
    const out = redactSensitive(text);
    expect(out).toContain(REDACTED);
    expect(out).not.toContain(secret);
  });

  it('no toca datos normales de un producto', () => {
    const text = 'Algodón peinado, talles 1 a 6, ideal para 2 a 4 años, pack x 3 unidades';
    expect(redactSensitive(text)).toBe(text);
  });
});

describe('datos que llegan al modelo', () => {
  it('las notas se limpian antes de armar el prompt', () => {
    const input = normalizeInput({
      name: 'Conjunto kiki',
      notes: 'algodón; consultas a jessica@gmail.com o al 11 2345-6789',
    });
    const prompt = buildUserPrompt(input);
    expect(prompt).toContain('algodón');
    expect(prompt).not.toContain('jessica@gmail.com');
    expect(prompt).not.toContain('2345-6789');
  });

  it('solo se envían los campos del producto (nada del cliente ni del pedido)', () => {
    const input = normalizeInput({
      name: 'Enterito',
      email: 'cliente@mail.com',
      customerId: 7,
      orderId: 99,
      password: 'secreto',
    });
    expect(Object.keys(input).sort()).toEqual(['categoryName', 'colors', 'name', 'notes', 'productId', 'sizes']);
    expect(buildUserPrompt(input)).not.toMatch(/cliente@mail\.com|secreto/);
  });
});

describe('resolveReasoningEffort', () => {
  it('apaga el razonamiento con un modelo local', async () => {
    const { resolveReasoningEffort } = await import('../lib/ai.js');
    expect(resolveReasoningEffort('http://localhost:11434/v1', '')).toBe('none');
    expect(resolveReasoningEffort('http://100.80.1.2:11434/v1', '')).toBe('none');
  });

  it('no lo envía a un proveedor externo salvo que se configure', async () => {
    const { resolveReasoningEffort } = await import('../lib/ai.js');
    expect(resolveReasoningEffort('https://api.openai.com/v1', '')).toBeNull();
    expect(resolveReasoningEffort('https://api.openai.com/v1', 'low')).toBe('low');
  });
});
