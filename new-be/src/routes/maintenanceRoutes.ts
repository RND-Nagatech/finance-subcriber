import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { getLatestPatchJob, getPatchJob, startPatchJob } from '../controllers/maintenancePatchController';

const router = Router();

router.use(authenticate);

router.post('/patch/run', startPatchJob);
router.get('/patch/latest', getLatestPatchJob);
router.get('/patch/jobs/:id', getPatchJob);

export default router;

