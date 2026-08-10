import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import {
  getCustomers, getCustomer, createCustomer, updateCustomer,
  deleteCustomer, customerValidation, addFollowUpNote, deleteFollowUpNote
} from '../controllers/customerController';

const router = Router();
router.use(authenticate);

router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.post('/', requireRole('admin', 'sales'), customerValidation, createCustomer);
router.put('/:id', requireRole('admin', 'sales'), customerValidation, updateCustomer);
router.delete('/:id', requireRole('admin'), deleteCustomer);
router.post('/:id/notes', requireRole('admin', 'sales'), addFollowUpNote);
router.delete('/:id/notes/:noteId', requireRole('admin'), deleteFollowUpNote);

export default router;
