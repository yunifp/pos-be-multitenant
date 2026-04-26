import { Router } from 'express';
import { getFinancialAgregation  } from '../controllers/financial.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);
router.get('/report', authorizeRole(['OWNER', 'MANAGER']), getFinancialAgregation);

export default router;