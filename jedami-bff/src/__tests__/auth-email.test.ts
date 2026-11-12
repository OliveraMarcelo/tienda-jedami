import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { pool } from '../config/database.js';

// Simula el envío de emails configurado y captura lo que se manda
const sent: { to: string; subject: string; text: string; html: string }[] = [];
vi.mock('../lib/mailer.js', () => ({
  isMailerConfigured: () => true,
  sendMail: async (msg: { to: string; subject: string; text: string; html: string }) => {
    sent.push(msg);
    return true;
  },
}));

const { testApp } = await import('./helpers/app.js');

const BASE = '/api/v1/auth';
const EMAIL = 'nuevo@example.com';
const PASSWORD = 'Password123!';

const lastCode = () => /código para confirmar tu email es: (\d{6})/.exec(sent.at(-1)?.text ?? '')?.[1];
const lastResetToken = () => /token=([a-f0-9]{64})/.exec(sent.at(-1)?.text ?? '')?.[1];

beforeEach(() => { sent.length = 0; });

describe('Verificación de email (con emails configurados)', () => {
  it('el registro manda un código y el login queda bloqueado hasta confirmar', async () => {
    const reg = await request(testApp).post(`${BASE}/register`).send({ email: EMAIL, password: PASSWORD });
    expect(reg.status).toBe(201);
    expect(reg.body.data.verificationRequired).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(EMAIL);
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);

    const login = await request(testApp).post(`${BASE}/login`).send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.type).toBe('https://jedami.com/errors/email-not-verified');

    const verify = await request(testApp).post(`${BASE}/verify-email`).send({ email: EMAIL, code });
    expect(verify.status).toBe(200);
    expect(verify.body.data).toHaveProperty('token');
    expect(verify.body.data).toHaveProperty('refreshToken');

    const login2 = await request(testApp).post(`${BASE}/login`).send({ email: EMAIL, password: PASSWORD });
    expect(login2.status).toBe(200);
  });

  it('con contraseña incorrecta responde 401 aunque el email no esté verificado', async () => {
    await request(testApp).post(`${BASE}/register`).send({ email: EMAIL, password: PASSWORD });
    const login = await request(testApp).post(`${BASE}/login`).send({ email: EMAIL, password: 'otraClave123' });
    expect(login.status).toBe(401);
  });

  it('un código incorrecto descuenta intentos y a los 5 se bloquea', async () => {
    await request(testApp).post(`${BASE}/register`).send({ email: EMAIL, password: PASSWORD });
    const code = lastCode()!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const res = await request(testApp).post(`${BASE}/verify-email`).send({ email: EMAIL, code: wrong });
      expect(res.status).toBe(400);
    }
    const res = await request(testApp).post(`${BASE}/verify-email`).send({ email: EMAIL, code });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('demasiados intentos');
  });

  it('el reenvío respeta 1 minuto entre códigos y no revela si el email existe', async () => {
    await request(testApp).post(`${BASE}/register`).send({ email: EMAIL, password: PASSWORD });
    sent.length = 0;
    const again = await request(testApp).post(`${BASE}/resend-verification`).send({ email: EMAIL });
    expect(again.status).toBe(200);
    expect(sent).toHaveLength(0); // cooldown

    const unknown = await request(testApp).post(`${BASE}/resend-verification`).send({ email: 'nadie@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(again.body);
  });
});

describe('Recuperar contraseña', () => {
  beforeEach(async () => {
    await request(testApp).post(`${BASE}/register`).send({ email: EMAIL, password: PASSWORD });
    await pool.query("UPDATE users SET email_verified_at = NULL WHERE email = $1", [EMAIL]);
    sent.length = 0;
  });

  it('manda un link, cambia la contraseña, verifica el email y cierra otras sesiones', async () => {
    const res = await request(testApp).post(`${BASE}/forgot-password`).send({ email: 'NUEVO@example.com' });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    const token = lastResetToken();
    expect(token).toBeDefined();

    const reset = await request(testApp).post(`${BASE}/reset-password`).send({ token, password: 'NuevaClave456' });
    expect(reset.status).toBe(200);
    expect(reset.body.data).toHaveProperty('token');

    // El link sirve una sola vez
    const again = await request(testApp).post(`${BASE}/reset-password`).send({ token, password: 'OtraClave789' });
    expect(again.status).toBe(400);

    const oldLogin = await request(testApp).post(`${BASE}/login`).send({ email: EMAIL, password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(testApp).post(`${BASE}/login`).send({ email: EMAIL, password: 'NuevaClave456' });
    expect(newLogin.status).toBe(200);
  });

  it('responde igual si el email no existe y no manda nada', async () => {
    const res = await request(testApp).post(`${BASE}/forgot-password`).send({ email: 'nadie@example.com' });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it('rechaza contraseña nueva corta y tokens inválidos', async () => {
    await request(testApp).post(`${BASE}/forgot-password`).send({ email: EMAIL });
    const token = lastResetToken();
    const short = await request(testApp).post(`${BASE}/reset-password`).send({ token, password: 'corta' });
    expect(short.status).toBe(400);
    const bad = await request(testApp).post(`${BASE}/reset-password`).send({ token: 'a'.repeat(64), password: 'NuevaClave456' });
    expect(bad.status).toBe(400);
  });
});

describe('GET /config', () => {
  it('informa que el email está habilitado y Google apagado', async () => {
    const res = await request(testApp).get('/api/v1/config');
    expect(res.status).toBe(200);
    expect(res.body.data.auth).toEqual({ emailEnabled: true, googleClientId: null });
  });
});
