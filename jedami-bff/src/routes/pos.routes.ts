import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../lib/constants.js';
import {
  listDevicesHandler,
  syncDevicesHandler,
  updateDeviceHandler,
  createIntentHandler,
  getIntentHandler,
  cancelIntentHandler,
  confirmPointPaymentHandler,
} from '../modules/pos/pos.controller.js';

const router = Router();

router.use(authMiddleware, requireRole([ROLES.ADMIN]));

router.get('/devices',                  listDevicesHandler);
router.post('/devices/sync',            syncDevicesHandler);
router.patch('/devices/:id',            updateDeviceHandler);

router.post('/orders/:orderId/intent',    createIntentHandler);
router.get('/orders/:orderId/intent',     getIntentHandler);
router.delete('/orders/:orderId/intent',  cancelIntentHandler);
router.patch('/orders/:orderId/confirm',  confirmPointPaymentHandler);

export default router;
