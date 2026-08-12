import { Router } from 'express';
import { getAllBanks, getBankById, createBank, updateBank, deleteBank } from '../controllers/bankController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.get('/', getAllBanks);
router.get('/:id', getBankById);
router.post('/', authenticate, createBank);
router.put('/:id', authenticate, updateBank);
router.delete('/:id', authenticate, deleteBank);

export default router;
