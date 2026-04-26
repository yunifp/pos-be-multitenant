import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Fungsi ini menerima nama subfolder (misal: 'products', 'avatars', 'banners')
export const createUploader = (subfolder: string) => {
    
    // 1. Tentukan Path Absolute: root/uploads/nama_folder
    const uploadDir = path.join(__dirname, '../../uploads', subfolder);

    // 2. Buat folder jika belum ada (Recursive: akan buat 'uploads' dulu jika belum ada)
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 3. Konfigurasi Storage
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            // Nama file: folder-timestamp-random.ext
            // Contoh: products-17099999-12345.jpg
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            cb(null, `${subfolder}-${uniqueSuffix}${ext}`);
        }
    });

    // 4. Filter File (Hanya Gambar)
    const fileFilter = (req: any, file: any, cb: any) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
        }
    };

    // 5. Return Instance Multer
    return multer({ 
        storage: storage, 
        fileFilter: fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 } // Limit 5MB
    });
};