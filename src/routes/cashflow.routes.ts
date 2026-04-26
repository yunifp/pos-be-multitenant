import { Router } from 'express';
import { getCashFlows, createCashFlow, updateCashFlow, deleteCashFlow } from '../controllers/cashflow.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', authorizeRole(['OWNER', 'MANAGER']), getCashFlows);
router.post('/', authorizeRole(['OWNER', 'MANAGER']), createCashFlow);
router.put('/:id', authorizeRole(['OWNER']), updateCashFlow);
router.delete('/:id', authorizeRole(['OWNER']), deleteCashFlow);

export default router;