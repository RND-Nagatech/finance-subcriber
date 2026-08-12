import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { availableSubscribers } from '../controllers/subscriptionVpsAdapterController';

const router = Router();

router.use(authenticate);
router.get('/available-subscribers', availableSubscribers);

export default router;
