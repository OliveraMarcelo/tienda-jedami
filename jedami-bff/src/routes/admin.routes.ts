import { Router } from 'express';
import { getDashboard } from '../modules/admin/admin.controller.js';

const router = Router();

router.get('/dashboard', getDashboard);

export default router;
