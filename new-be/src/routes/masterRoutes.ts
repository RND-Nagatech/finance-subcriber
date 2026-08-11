import { Router } from 'express';
import rekeningRoutes from './rekeningRoutes';
import {
  listProgram, createProgram, updateProgram, deleteProgram,
} from '../controllers/masterController';
import { authenticate } from '../middleware/authMiddleware';
const router = Router();

// Program routes
router.get('/program', listProgram);
router.post('/program', authenticate, createProgram);
router.put('/program/:id', authenticate, updateProgram);
router.delete('/program/:id', authenticate, deleteProgram);

router.use('/rekening', rekeningRoutes);

export default router;
