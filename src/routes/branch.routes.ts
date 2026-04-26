import { Router } from 'express';
import { createBranch, getAllBranches, updateBranch, deleteBranch, getBranchById } from '../controllers/branch.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Semua role butuh lihat cabang (untuk login/pilih konteks), tapi management hanya Owner
router.get('/', getAllBranches);
router.get('/:id', getBranchById);

// Aksi Tulis Khusus Owner
router.post('/', authorizeRole(['OWNER']), createBranch);
router.put('/:id', authorizeRole(['OWNER']), updateBranch);
router.delete('/:id', authorizeRole(['OWNER']), deleteBranch);

export default router;