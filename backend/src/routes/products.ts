import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, productValidation, stockMovementValidation, addStockMovement, getStockMovements
} from '../controllers/productController';

const router = Router();
router.use(authenticate);

router.get('/', getProducts);
router.get('/movements', getStockMovements);
router.get('/:id', getProduct);
router.post('/', requireRole('admin', 'warehouse'), productValidation, createProduct);
router.put('/:id', requireRole('admin', 'warehouse'), productValidation, updateProduct);
router.delete('/:id', requireRole('admin'), deleteProduct);
router.post('/:id/stock', requireRole('admin', 'warehouse'), stockMovementValidation, addStockMovement);

export default router;
