import { Router } from 'express';
import { 
    getMembers, 
    createMember, 
    updateMember, 
    deleteMember,
    verifyMember,
} from '../controllers/member.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

// Semua rute di bawah ini memerlukan login (authenticate)
// Dan hanya bisa diakses oleh OWNER atau MANAGER (authorizeRole)
router.use(authenticate);
router.use(authorizeRole(['CASHIER','OWNER', 'MANAGER']));

// Rute untuk mengambil daftar member (GET /api/members)
router.get('/', getMembers);

router.get('/verify/:phone', verifyMember);

// Rute untuk menambah member baru (POST /api/members)
router.post('/', createMember);

// Rute untuk memperbarui data member (PUT /api/members/:id)
router.put('/:id', updateMember);

// Rute untuk menghapus member (DELETE /api/members/:id)
router.delete('/:id', deleteMember);


export default router;