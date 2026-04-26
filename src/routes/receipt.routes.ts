import { Router } from 'express';
import { receiptController } from '../controllers/receipt.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);
router.get('/:branchId', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), receiptController.getSetting);
router.put('/:branchId', authorizeRole(['OWNER', 'MANAGER']), receiptController.updateSetting);

export default router;