import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';
import { createUploader } from '../utils/uploader';

const router = Router();

// [PENTING] Gunakan folder 'settings' -> /uploads/settings/
const upload = createUploader('settings');

// Public GET
router.get('/', getSettings);

// Protected PUT
router.put('/', 
  authenticate, 
  authorizeRole(['OWNER', 'MANAGER']), 
  // [PENTING] Fields harus match dengan formData.append di Frontend
  upload.fields([
    { name: 'logoUrl', maxCount: 1 }, 
    { name: 'loginBgUrl', maxCount: 1 }
  ]), 
  updateSettings
);

export default router;