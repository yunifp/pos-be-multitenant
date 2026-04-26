import { Router } from 'express';
import { orderHistoryController } from '../controllers/orderhistory.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), orderHistoryController.getHistory);
router.post('/refund-request', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), orderHistoryController.requestRefund);
router.post('/refund-handle', authorizeRole(['OWNER', 'MANAGER']), orderHistoryController.handleRefund);

export default router;