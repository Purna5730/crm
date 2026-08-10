import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { getChallans, getChallan, createChallan, updateChallanStatus } from '../controllers/challanController';

const router = Router();
router.use(authenticate);

router.get('/', getChallans);
router.get('/:id', getChallan);
router.post('/', requireRole('admin', 'sales'), createChallan);
router.patch('/:id/status', requireRole('admin', 'sales'), updateChallanStatus);

export default router;
