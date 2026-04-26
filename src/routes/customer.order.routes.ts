import { Router } from 'express';
import { CustomerOrderController } from '../controllers/customer.order.controller';

const router = Router();

// Route to get menu by branch ID for QR landing page
router.get('/menu/:branchId', CustomerOrderController.getInitialData);
router.get('/members/verify/:phone', CustomerOrderController.verifyMember);

// Route to create a new order and generate Midtrans snap token
router.post('/order', CustomerOrderController.createOrder);

router.get('/order/print/:id', CustomerOrderController.getOrderPrintData);

// handle notification from Midtrans
router.post('/midtrans/notification', CustomerOrderController.handleNotification);

export default router;