import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

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

const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function makeStorage(dest: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}

function makeUpload(dest: string) {
  return multer({
    storage: makeStorage(dest),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif)'));
      }
    },
  }).single('image');
}

export const uploadMiddleware              = makeUpload(UPLOADS_DIR);
export const uploadBrandingMiddleware      = makeUpload(UPLOADS_BRANDING_DIR);
export const uploadBannersMiddleware       = makeUpload(UPLOADS_BANNERS_DIR);
export const uploadAnnouncementsMiddleware = makeUpload(UPLOADS_ANNOUNCEMENTS_DIR);
