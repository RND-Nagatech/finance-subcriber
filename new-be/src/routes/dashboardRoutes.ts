import { Router } from 'express';
import { subscriberGrowth, subscriberCumulative, subscriberByProgram } from '../controllers/subscriberVpsDashboardController';
import { authenticate } from '../middleware/authMiddleware';
const router = Router();

router.use(authenticate);

router.get('/subscriber-growth/:tahun', subscriberGrowth);
router.get('/subscriber-cumulative/:tahun', subscriberCumulative);
router.get('/subscriber-by-program', subscriberByProgram);

export default router;
