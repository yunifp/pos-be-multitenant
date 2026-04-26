import { Router } from 'express';
import { createProduct, getProducts, updateProduct, deleteProduct } from '../controllers/product.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';
import { createUploader } from '../utils/uploader';

const router = Router();

const uploadProduct = createUploader('products');

router.use(authenticate);


router.get('/', getProducts);

router.post('/', authorizeRole(['OWNER', 'MANAGER']), uploadProduct.single('image'), createProduct);

router.put('/:id', authorizeRole(['OWNER', 'MANAGER']), uploadProduct.single('image'), updateProduct);

router.delete('/:id', authorizeRole(['OWNER', 'MANAGER']), deleteProduct);

export default router;