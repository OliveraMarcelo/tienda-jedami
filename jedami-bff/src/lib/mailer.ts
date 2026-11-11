import nodemailer, { type Transporter } from 'nodemailer';
import { ENV } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter: Transporter | null = null;

export function isMailerConfigured(): boolean {
  return !!ENV.SMTP_HOST && !!ENV.MAIL_FROM;
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_PORT === 465,
      auth: ENV.SMTP_USER ? { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/** Envía un email. Devuelve false si el envío no está configurado o falla (nunca lanza). */
export async function sendMail(msg: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  if (!isMailerConfigured()) {
    logger.debug({ to: msg.to, subject: msg.subject }, '[MAIL] SMTP no configurado, email omitido');
    return false;
  }
  try {
    await getTransporter().sendMail({ from: ENV.MAIL_FROM, ...msg });
    logger.info({ to: msg.to, subject: msg.subject }, '[MAIL] Email enviado');
    return true;
  } catch (err) {
    logger.error({ err, to: msg.to, subject: msg.subject }, '[MAIL] Error enviando email');
    return false;
  }
}
