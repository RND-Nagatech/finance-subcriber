import { Router } from 'express';
import { availableSubscribers, createVps, deleteVps, getVps, listVps, regenerateNextFiscalYear, updateVps } from '../controllers/vpsController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', listVps);
router.get('/available-subscribers', availableSubscribers);
router.get('/:id', getVps);
router.post('/', createVps);
router.put('/:id', updateVps);
router.delete('/:id', deleteVps);

// Trigger next fiscal periods generation (to run after tutup buku)
router.post('/maintenance/generate-next-fiscal', regenerateNextFiscalYear);

export default router;
