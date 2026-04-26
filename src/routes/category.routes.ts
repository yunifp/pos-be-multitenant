import { Router } from 'express';
import { createCategory, getCategories, deleteCategory, updateCategory } from '../controllers/category.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

// Semua endpoint butuh login
router.use(authenticate);

// GET: Semua role bisa lihat kategori (sesuai cabang masing-masing di controller)
router.get('/', getCategories);

// POST: Hanya Owner & Manager yang bisa buat kategori
router.post('/', authorizeRole(['OWNER', 'MANAGER']), createCategory);
router.put('/:id', authorizeRole(['OWNER', 'MANAGER']), updateCategory);

// DELETE: Hanya Owner & Manager yang bisa hapus
router.delete('/:id', authorizeRole(['OWNER', 'MANAGER']), deleteCategory);

export default router;