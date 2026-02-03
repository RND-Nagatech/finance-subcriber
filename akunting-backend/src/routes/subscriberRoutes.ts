import { Router } from 'express';
import {
  listSubscriber, createSubscriber, updateSubscriber, deleteSubscriber, getSubscriberYears,
} from '../controllers/masterController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Subscriber routes
router.get('/', listSubscriber);
router.get('/years', getSubscriberYears);
router.post('/', authenticate, createSubscriber);
router.put('/:id', authenticate, updateSubscriber);
router.delete('/:id', authenticate, deleteSubscriber);

export default router;