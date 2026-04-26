import { Router } from 'express';
import { expenseController,  } from '../controllers/expense.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';
import { createUploader } from '../utils/uploader';

const router = Router();

const upload = createUploader('receipts');

router.use(authenticate);
router.get('/', authorizeRole(['OWNER', 'MANAGER']), expenseController.getExpenses);
router.post('/', authorizeRole(['OWNER', 'MANAGER']), upload.single('image'), expenseController.createExpense);
router.put('/:id', authorizeRole(['OWNER', 'MANAGER']), upload.single('image'), expenseController.updateExpense);
router.delete('/:id', authorizeRole(['OWNER']), expenseController.deleteExpense);

export default router;