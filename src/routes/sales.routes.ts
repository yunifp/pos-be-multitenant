import { Router } from 'express';
import { getSalesReport } from '../controllers/sales.controller';
import { authenticate, authorizeRole} from '../middlewares/auth.middleware';

const router = Router();

// Route untuk mendapatkan laporan penjualan
router.get('/reports', authenticate, authorizeRole(['OWNER', 'MANAGER']), getSalesReport);

export default router;