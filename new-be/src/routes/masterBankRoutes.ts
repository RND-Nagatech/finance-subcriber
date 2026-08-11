import { Router } from 'express';
import bankRoutes from './bankRoutes';
import rekeningRoutes from './rekeningRoutes';

const router = Router();

router.use('/bank', bankRoutes);
router.use('/rekening', rekeningRoutes);

export default router;
