import { Router } from 'express';
import { createPromotion, getPromotions, deletePromotion, updatePromotion, getPromotionsByBranchAndType } from '../controllers/promotion.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', authorizeRole(['OWNER', 'MANAGER']), getPromotions);
router.get('/by-branch-and-type', authorizeRole(['OWNER', 'MANAGER', 'CASHIER']), getPromotionsByBranchAndType);
router.post('/', authorizeRole(['OWNER', 'MANAGER']), createPromotion);
router.put('/:id', authorizeRole(['OWNER', 'MANAGER']), updatePromotion);
router.delete('/:id', authorizeRole(['OWNER', 'MANAGER']), deletePromotion);

export default router;