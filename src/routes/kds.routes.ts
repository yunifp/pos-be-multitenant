import { Router } from 'express';
import { kdsController  } from '../controllers/kds.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorizeRole(['CASHIER', 'OWNER', 'MANAGER']));
router.get('/queue', kdsController.getQueue);
router.post('/item-ready', kdsController.toggleItemReady);
router.post('/status', kdsController.updateOrderStatus);

export default router;