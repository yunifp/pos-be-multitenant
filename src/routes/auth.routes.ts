import { Router } from 'express';
import { login, unlockSession, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Public Routes
router.post('/login', login);
router.post('/unlock', unlockSession); // Masuk pakai PIN

// Protected Routes (Harus ada Token)
router.get('/me', authenticate, getMe); 

export default router;