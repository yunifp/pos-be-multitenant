import { Router } from 'express';
import { createUser, getUsers, updateUser, deleteUser } from '../controllers/user.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Hanya Owner dan Manager yang boleh akses
const allowedRoles = ['OWNER', 'MANAGER'];

router.get('/', authorizeRole(allowedRoles), getUsers);
router.post('/', authorizeRole(allowedRoles), createUser);
router.put('/:id', authorizeRole(allowedRoles), updateUser);
router.delete('/:id', authorizeRole(allowedRoles), deleteUser);

export default router;