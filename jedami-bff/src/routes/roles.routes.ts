import { Router } from 'express';
import { listRoles } from '../modules/roles/roles.controller.js';

const router = Router();

router.get('/', listRoles);

export default router;
