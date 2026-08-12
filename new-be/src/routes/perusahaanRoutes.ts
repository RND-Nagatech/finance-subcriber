import { Router } from 'express';
import {
  getAllPerusahaan,
  createPerusahaan,
  updatePerusahaan,
  deletePerusahaan,
} from '../controllers/perusahaanController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.get('/', getAllPerusahaan);
router.post('/', authenticate, createPerusahaan);
router.put('/:id', authenticate, updatePerusahaan);
router.delete('/:id', authenticate, deletePerusahaan);

export default router;
