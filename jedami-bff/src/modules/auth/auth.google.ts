import { OAuth2Client } from 'google-auth-library';
import { ENV } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { pool } from '../../config/database.js';
import { AppError } from '../../types/app-error.js';
import * as usersRepository from '../users/users.repository.js';
import { CUSTOMER_TYPES, type CustomerType } from '../../lib/constants.js';
import { createUserWithCustomer, issueTokens, normalizeEmail } from './auth.service.js';

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
}

let client: OAuth2Client | null = null;

/** Verifica la firma, la audiencia y el vencimiento del ID token que entrega Google */
async function verifyWithGoogle(credential: string): Promise<GoogleIdentity> {
  client ??= new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken: credential, audience: ENV.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error('Token de Google sin email');
  return { sub: payload.sub, email: payload.email, emailVerified: payload.email_verified === true };
}

// Inyectable para tests: verificar contra Google de verdad no es posible sin red ni credenciales
let verifier: (credential: string) => Promise<GoogleIdentity> = verifyWithGoogle;
export function setGoogleVerifierForTests(fn: typeof verifier | null): void {
  verifier = fn ?? verifyWithGoogle;
}

export function isGoogleLoginEnabled(): boolean {
  return !!ENV.GOOGLE_CLIENT_ID;
}

/**
 * Inicia sesión (o crea la cuenta) con Google.
 * - Si la cuenta de Google ya está vinculada, entra.
 * - Si existe una cuenta con ese email, la vincula y la marca verificada (Google ya lo verificó).
 * - Si no existe, crea una cuenta sin contraseña con el tipo de cliente elegido.
 */
export async function loginWithGoogle(credential: string, customerType: CustomerType = CUSTOMER_TYPES.RETAIL) {
  if (!isGoogleLoginEnabled()) {
    throw new AppError(404, 'No disponible', 'https://jedami.com/errors/google-disabled', 'El ingreso con Google no está habilitado');
  }

  let identity: GoogleIdentity;
  try {
    identity = await verifier(credential);
  } catch (err) {
    logger.warn({ err }, '[AUTH] Token de Google rechazado');
    throw new AppError(401, 'Google no validó el ingreso', 'https://jedami.com/errors/invalid-google-token',
      'No pudimos validar tu cuenta de Google. Probá de nuevo.');
  }
  if (!identity.emailVerified) {
    throw new AppError(401, 'Email de Google sin verificar', 'https://jedami.com/errors/invalid-google-token',
      'Tu cuenta de Google no tiene el email verificado. Ingresá con email y contraseña.');
  }

  const email = normalizeEmail(identity.email);

  // 1. Cuenta ya vinculada a este usuario de Google
  const { rows } = await pool.query('SELECT email FROM users WHERE google_sub = $1', [identity.sub]);
  if (rows[0]) {
    const user = await usersRepository.findByEmailWithRoles(rows[0].email);
    if (user) return issueTokens(user);
  }

  // 2. Cuenta existente con el mismo email: vincular
  const existing = await usersRepository.findByEmailWithRoles(email);
  if (existing) {
    if (existing.google_sub && existing.google_sub !== identity.sub) {
      throw new AppError(409, 'Cuenta vinculada a otro Google', 'https://jedami.com/errors/google-conflict',
        'Ese email ya está vinculado a otra cuenta de Google. Ingresá con email y contraseña.');
    }
    await pool.query(
      'UPDATE users SET google_sub = $2, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1',
      [existing.id, identity.sub],
    );
    return issueTokens(existing);
  }

  // 3. Cuenta nueva (sin contraseña: si después quiere una, usa "Olvidé mi contraseña")
  const type = customerType === CUSTOMER_TYPES.WHOLESALE ? CUSTOMER_TYPES.WHOLESALE : CUSTOMER_TYPES.RETAIL;
  const created = await createUserWithCustomer(email, null, type, { verified: true, googleSub: identity.sub });
  const user = await usersRepository.findByIdWithRoles(created.id);
  return issueTokens(user ?? { ...created, roles: [type] });
}
