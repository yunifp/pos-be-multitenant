import { Router } from 'express';
import { handlePOSOrder, getOpenTickets, getOrderPrintData } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
router.post('/pos', authenticate, handlePOSOrder);
router.get('/open-tickets', authenticate, getOpenTickets);
router.get('/print/:id', authenticate, getOrderPrintData);

export default router;