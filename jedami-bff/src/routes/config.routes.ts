import { Router } from 'express';
import { getConfig } from '../modules/config/config.controller.js';

const router = Router();

// GET /config — público, sin autenticación
router.get('/', getConfig);

export default router;
