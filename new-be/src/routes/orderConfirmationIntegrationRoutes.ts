import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { detailNoOk, searchNoOk } from '../controllers/orderConfirmationIntegrationController';

const router = Router();

router.use(authenticate);

router.get('/no-ok/search', searchNoOk);
router.get('/no-ok/detail', detailNoOk);

export default router;
