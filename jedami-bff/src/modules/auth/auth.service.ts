import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ENV } from '../../config/env.js';
import { AppError } from '../../types/app-error.js';
import { pool } from '../../config/database.js';
import * as usersRepository from '../users/users.repository.js';
import * as customersRepository from '../customers/customers.repository.js';
import { JwtUserPayload } from './jwt-payload.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
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

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(email: string, password: string, customerType: 'retail' | 'wholesale' = 'retail') {
  const existing = await usersRepository.findByEmail(email);
  if (existing) {
    throw new AppError(
      400,
      'Email duplicado',
      'https://jedami.com/errors/email-already-exists',
      `El email ${email} ya está registrado`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await usersRepository.create(email, passwordHash);

  // Crear perfil de comprador con el tipo elegido
  await customersRepository.createCustomer(user.id, customerType);

  // Asignar el rol correspondiente automáticamente
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = $2
     ON CONFLICT DO NOTHING`,
    [user.id, customerType],
  );

  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
  };
}

// Hash inerte usado para normalizar el tiempo de respuesta cuando el usuario no existe
// (previene enumeración de emails por timing side-channel)
const DUMMY_HASH = '$2b$10$invalidhashfortimingprotection.';

// ─── Login ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const user = await usersRepository.findByEmailWithRoles(email);

  // Siempre ejecutar bcrypt.compare para normalizar el tiempo de respuesta
  const isValid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !isValid) {
    throw new AppError(
      401,
      'Credenciales inválidas',
      'https://jedami.com/errors/invalid-credentials',
      'Email o contraseña incorrectos',
    );
  }

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

  const newRefreshToken = generateRefreshToken();
  await storeRefreshToken(user.id, newRefreshToken);

  return { token: accessToken, refreshToken: newRefreshToken };
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
