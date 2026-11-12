import { describe, it, expect } from 'vitest';
import { buildPasswordResetEmail, buildVerificationCodeEmail } from '../modules/notifications/auth-emails.js';
import { generateVerificationCode, validateNewPassword } from '../modules/auth/auth.service.js';

describe('buildVerificationCodeEmail', () => {
  it('incluye el código, el vencimiento y escapa el nombre de la tienda', () => {
    const email = buildVerificationCodeEmail('042731', 'Jedami <Kids>', 15);
    expect(email.subject).toBe('Tu código de verificación: 042731 — Jedami <Kids>');
    expect(email.text).toContain('042731');
    expect(email.text).toContain('15 minutos');
    expect(email.html).toContain('042731');
    expect(email.html).toContain('Jedami &lt;Kids&gt;');
    expect(email.html).not.toContain('Jedami <Kids>');
  });
});

describe('buildPasswordResetEmail', () => {
  it('incluye el link y avisa que vence', () => {
    const url = 'https://www.jedamiapp.com/restablecer-contrasena?token=abc';
    const email = buildPasswordResetEmail(url, 'Jedami', 60);
    expect(email.subject).toBe('Restablecé tu contraseña — Jedami');
    expect(email.text).toContain(url);
    expect(email.html).toContain(`href="${url}"`);
    expect(email.html).toContain('60 minutos');
  });
});

describe('generateVerificationCode', () => {
  it('siempre devuelve 6 dígitos', () => {
    for (let i = 0; i < 200; i++) expect(generateVerificationCode()).toMatch(/^\d{6}$/);
  });
});

describe('validateNewPassword', () => {
  it('exige entre 8 y 72 bytes', () => {
    expect(() => validateNewPassword('1234567')).toThrow('al menos 8');
    expect(() => validateNewPassword(undefined)).toThrow();
    expect(validateNewPassword('12345678')).toBe('12345678');
    expect(() => validateNewPassword('a'.repeat(73))).toThrow('como máximo');
  });
});
