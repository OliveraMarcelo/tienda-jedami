import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ENV } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../types/app-error.js';
import { pool } from '../../config/database.js';
import * as usersRepository from '../users/users.repository.js';
import type { User } from '../users/users.entity.js';
import { JwtUserPayload } from './jwt-payload.js';
import { CUSTOMER_TYPES, type CustomerType } from '../../lib/constants.js';
import { isMailerConfigured, sendMail } from '../../lib/mailer.js';
import { buildPasswordResetEmail, buildVerificationCodeEmail, getStoreName } from '../notifications/auth-emails.js';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt solo usa los primeros 72 bytes: más largo no suma seguridad
const PASSWORD_MAX_LENGTH = 72;
const VERIFICATION_CODE_MINUTES = 15;
const VERIFICATION_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const RESET_TOKEN_MINUTES = 60;

const ERR_VALIDATION = 'https://jedami.com/errors/validation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function normalizeEmail(email: string): string {
  return String(email).trim().toLowerCase();
}

/** Valida la contraseña nueva (registro y restablecer). Exportado para tests. */
export function validateNewPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(400, 'Contraseña muy corta', ERR_VALIDATION, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_LENGTH) {
    throw new AppError(400, 'Contraseña muy larga', ERR_VALIDATION, `La contraseña puede tener como máximo ${PASSWORD_MAX_LENGTH} caracteres`);
  }
  return password;
}

/** Código numérico de 6 dígitos con generador criptográfico. Exportado para tests. */
export function generateVerificationCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** La verificación solo se exige cuando el envío de emails está configurado */
export function isEmailVerificationEnabled(): boolean {
  return isMailerConfigured();
}

function parseExpiresInMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 días
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

async function storeRefreshToken(userId: number, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + parseExpiresInMs(ENV.JWT_REFRESH_EXPIRES_IN));

  // Limpiar tokens expirados o revocados para evitar crecimiento indefinido de la tabla
  await pool.query(
    `DELETE FROM refresh_tokens WHERE user_id = $1 AND (expires_at < NOW() OR revoked_at IS NOT NULL)`,
    [userId],
  );

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

/** Emite access token + refresh token para un usuario ya autenticado */
export async function issueTokens(user: Pick<User, 'id' | 'email' | 'roles'>) {
  const payload: JwtUserPayload = {
    id: user.id,
    email: user.email,
    roles: user.roles ?? [],
  };

  const accessToken = jwt.sign(
    payload,
    ENV.JWT_SECRET as jwt.Secret,
    { expiresIn: ENV.JWT_EXPIRES_IN } as jwt.SignOptions,
  );

  const refreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, refreshToken);

  return { token: accessToken, refreshToken };
}

/** Crea usuario + perfil de comprador + rol en una transacción */
export async function createUserWithCustomer(
  email: string,
  passwordHash: string | null,
  customerType: CustomerType,
  opts: { verified: boolean; googleSub?: string | null },
): Promise<User> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await usersRepository.create(email, passwordHash, opts, client);
    await client.query('INSERT INTO customers (user_id, customer_type) VALUES ($1, $2)', [user.id, customerType]);
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = $2
       ON CONFLICT DO NOTHING`,
      [user.id, customerType],
    );
    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    // Carrera entre dos registros con el mismo email
    if ((err as { code?: string }).code === '23505') throw duplicateEmailError();
    throw err;
  } finally {
    client.release();
  }
}

function duplicateEmailError() {
  return new AppError(
    409,
    'Email ya registrado',
    'https://jedami.com/errors/email-already-exists',
    'Ese email ya tiene una cuenta. Iniciá sesión o recuperá tu contraseña.',
  );
}

// ─── Verificación de email ──────────────────────────────────────────────────

/**
 * Genera y envía un código nuevo. Respeta un tiempo mínimo entre envíos.
 * Devuelve false si no se envió (cooldown o email no configurado).
 */
async function sendVerificationCode(user: Pick<User, 'id' | 'email'>): Promise<boolean> {
  if (!isMailerConfigured()) return false;

  const recent = await pool.query(
    `SELECT 1 FROM email_verification_codes
     WHERE user_id = $1 AND created_at > NOW() - make_interval(secs => $2)`,
    [user.id, RESEND_COOLDOWN_SECONDS],
  );
  if (recent.rowCount) return false;

  const code = generateVerificationCode();
  await pool.query('DELETE FROM email_verification_codes WHERE user_id = $1', [user.id]);
  await pool.query(
    `INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
    [user.id, hashToken(code), VERIFICATION_CODE_MINUTES],
  );

  const email = buildVerificationCodeEmail(code, await getStoreName(), VERIFICATION_CODE_MINUTES);
  return sendMail({ to: user.email, ...email });
}

function emailNotVerifiedError() {
  return new AppError(
    403,
    'Email sin verificar',
    'https://jedami.com/errors/email-not-verified',
    'Te mandamos un código por email para confirmar tu cuenta.',
  );
}

export async function verifyEmail(rawEmail: string, rawCode: string) {
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode ?? '').replace(/\D/g, '');
  const invalid = (detail: string) => new AppError(400, 'Código inválido', 'https://jedami.com/errors/invalid-code', detail);

  if (code.length !== 6) throw invalid('El código tiene 6 números');

  const user = await usersRepository.findByEmailWithRoles(email);
  if (!user) throw invalid('El código es incorrecto o ya venció. Pedí uno nuevo.');
  if (user.email_verified_at) {
    throw new AppError(409, 'Email ya verificado', 'https://jedami.com/errors/already-verified', 'Tu email ya está confirmado. Iniciá sesión.');
  }

  const { rows } = await pool.query(
    `SELECT id, code_hash, expires_at, attempts FROM email_verification_codes
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [user.id],
  );
  const row = rows[0];
  if (!row || new Date(row.expires_at) < new Date()) throw invalid('El código venció. Pedí uno nuevo.');
  if (row.attempts >= VERIFICATION_MAX_ATTEMPTS) throw invalid('Hiciste demasiados intentos. Pedí un código nuevo.');

  if (!safeEqualHex(row.code_hash, hashToken(code))) {
    await pool.query('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    const left = VERIFICATION_MAX_ATTEMPTS - row.attempts - 1;
    throw invalid(left > 0 ? `El código es incorrecto. Te quedan ${left} intentos.` : 'Hiciste demasiados intentos. Pedí un código nuevo.');
  }

  await pool.query('UPDATE users SET email_verified_at = NOW() WHERE id = $1', [user.id]);
  await pool.query('DELETE FROM email_verification_codes WHERE user_id = $1', [user.id]);

  return issueTokens(user);
}

/** Reenvía el código. Siempre responde igual para no revelar qué emails existen. */
export async function resendVerification(rawEmail: string): Promise<void> {
  const user = await usersRepository.findByEmail(normalizeEmail(rawEmail));
  if (!user || user.email_verified_at) return;
  await sendVerificationCode(user);
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(rawEmail: string, password: string, customerType: CustomerType = CUSTOMER_TYPES.RETAIL) {
  const email = normalizeEmail(rawEmail);
  validateNewPassword(password);

  const existing = await usersRepository.findByEmail(email);
  if (existing) throw duplicateEmailError();

  const verificationRequired = isEmailVerificationEnabled();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUserWithCustomer(email, passwordHash, customerType, { verified: false });

  if (verificationRequired) {
    const sent = await sendVerificationCode(user);
    if (!sent) logger.warn({ userId: user.id }, '[AUTH] No se pudo enviar el código de verificación al registrarse');
  }

  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
    verificationRequired,
  };
}

// Hash real (de una contraseña al azar) para que el tiempo de respuesta sea el mismo
// exista o no el usuario: previene enumeración de emails por timing
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

// ─── Login ─────────────────────────────────────────────────────────────────────

export async function login(rawEmail: string, password: string) {
  const user = await usersRepository.findByEmailWithRoles(normalizeEmail(rawEmail));

  // Siempre ejecutar bcrypt.compare para normalizar el tiempo de respuesta.
  // Las cuentas creadas con Google no tienen contraseña: también fallan acá.
  const isValid = await bcrypt.compare(String(password), user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.password_hash || !isValid) {
    throw new AppError(
      401,
      'Credenciales inválidas',
      'https://jedami.com/errors/invalid-credentials',
      'Email o contraseña incorrectos',
    );
  }

  // Solo después de validar la contraseña: así no se revela si un email está verificado
  if (!user.email_verified_at && isEmailVerificationEnabled()) {
    await sendVerificationCode(user);
    throw emailNotVerifiedError();
  }

  return issueTokens(user);
}

// ─── Recuperar contraseña ─────────────────────────────────────────────────────

/** Manda el link para restablecer. Siempre responde igual para no revelar qué emails existen. */
export async function forgotPassword(rawEmail: string): Promise<void> {
  if (!isMailerConfigured()) return;
  const user = await usersRepository.findByEmail(normalizeEmail(rawEmail));
  if (!user) return;

  const recent = await pool.query(
    `SELECT 1 FROM password_reset_tokens
     WHERE user_id = $1 AND created_at > NOW() - make_interval(secs => $2)`,
    [user.id, RESEND_COOLDOWN_SECONDS],
  );
  if (recent.rowCount) return;

  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL', [user.id]);
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
    [user.id, hashToken(token), RESET_TOKEN_MINUTES],
  );

  const resetUrl = `${ENV.FRONTEND_URL}/restablecer-contrasena?token=${token}`;
  const email = buildPasswordResetEmail(resetUrl, await getStoreName(), RESET_TOKEN_MINUTES);
  await sendMail({ to: user.email, ...email });
}

/** Cambia la contraseña con el token del email y deja la sesión iniciada */
export async function resetPassword(rawToken: string, password: string) {
  validateNewPassword(password);
  const token = String(rawToken ?? '');
  const invalid = new AppError(400, 'Link inválido', 'https://jedami.com/errors/invalid-reset-token',
    'El link para restablecer la contraseña no es válido o ya venció. Pedí uno nuevo.');
  if (!/^[a-f0-9]{64}$/.test(token)) throw invalid;

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  let userId: number;
  try {
    await client.query('BEGIN');
    // FOR UPDATE: el mismo link no se puede usar dos veces en paralelo
    const { rows } = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [hashToken(token)],
    );
    if (!rows[0]) throw invalid;
    userId = rows[0].user_id;

    await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [rows[0].id]);
    // Quien recibió el link es dueño del email: queda verificado
    await client.query(
      'UPDATE users SET password_hash = $2, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1',
      [userId, passwordHash],
    );
    // Cerrar todas las sesiones abiertas con la contraseña anterior
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const user = await usersRepository.findByIdWithRoles(userId);
  if (!user) throw invalid;
  return issueTokens(user);
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export async function refreshAccessToken(rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);

  const result = await pool.query(
    `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at
     FROM refresh_tokens rt
     WHERE rt.token_hash = $1`,
    [tokenHash],
  );

  const row = result.rows[0];
  if (!row) {
    throw new AppError(401, 'Token inválido', 'https://jedami.com/errors/invalid-token', 'El refresh token no es válido');
  }
  if (row.revoked_at) {
    throw new AppError(401, 'Token revocado', 'https://jedami.com/errors/token-revoked', 'El refresh token fue revocado');
  }
  if (new Date(row.expires_at) < new Date()) {
    throw new AppError(401, 'Token expirado', 'https://jedami.com/errors/token-expired', 'El refresh token expiró');
  }

  const user = await usersRepository.findByIdWithRoles(row.user_id);
  if (!user) {
    throw new AppError(401, 'Usuario no encontrado', 'https://jedami.com/errors/not-found', 'El usuario no existe');
  }

  // Revocar el token usado (rotación de refresh tokens)
  await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);

  return issueTokens(user);
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(userId: number) {
  // Revocar todos los refresh tokens activos del usuario
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}
