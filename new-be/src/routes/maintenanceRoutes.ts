import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { getLatestPatchJob, getPatchJob, listUnverifiedSubscriptionDetails, startPatchJob } from '../controllers/maintenancePatchController';

const router = Router();

router.use(authenticate);

router.post('/patch/run', startPatchJob);
router.get('/patch/latest', getLatestPatchJob);
router.get('/patch/jobs/:id', getPatchJob);
router.get('/patch/subscription/unverified', listUnverifiedSubscriptionDetails);

export default router;
