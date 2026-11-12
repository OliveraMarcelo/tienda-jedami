import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { AppError } from '../types/app-error.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR               = join(__dirname, '../../uploads/products');
export const UPLOADS_BRANDING_DIR      = join(__dirname, '../../uploads/branding');
export const UPLOADS_BANNERS_DIR       = join(__dirname, '../../uploads/banners');
export const UPLOADS_ANNOUNCEMENTS_DIR = join(__dirname, '../../uploads/announcements');

// Crear directorios si no existen al arrancar
mkdirSync(UPLOADS_DIR,               { recursive: true });
mkdirSync(UPLOADS_BRANDING_DIR,      { recursive: true });
mkdirSync(UPLOADS_BANNERS_DIR,       { recursive: true });
mkdirSync(UPLOADS_ANNOUNCEMENTS_DIR, { recursive: true });

// La extensión del archivo guardado sale del tipo de imagen, nunca del nombre que manda
// el cliente: así no se puede subir un ".html" o ".svg" disfrazado de imagen
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

const MAX_FILE_MB = 5;

/** Traduce un error de subida (multer o de validación) a un mensaje claro para el admin */
export function uploadErrorMessage(err: unknown): string {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return `La imagen supera el máximo de ${MAX_FILE_MB} MB`;
    return 'No se pudo procesar el archivo subido';
  }
  return err instanceof Error ? err.message : 'No se pudo procesar el archivo subido';
}

function makeStorage(dest: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${EXT_BY_MIME[file.mimetype] ?? '.jpg'}`);
    },
  });
}

function makeUpload(dest: string) {
  return multer({
    storage: makeStorage(dest),
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype in EXT_BY_MIME) {
        cb(null, true);
      } else {
        cb(new AppError(400, 'Archivo inválido', 'https://jedami.com/errors/validation', 'Solo se permiten imágenes (jpg, png, webp, gif)'));
      }
    },
  }).single('image');
}

export const uploadMiddleware              = makeUpload(UPLOADS_DIR);
export const uploadBrandingMiddleware      = makeUpload(UPLOADS_BRANDING_DIR);
export const uploadBannersMiddleware       = makeUpload(UPLOADS_BANNERS_DIR);
export const uploadAnnouncementsMiddleware = makeUpload(UPLOADS_ANNOUNCEMENTS_DIR);
