import { Router } from 'express';
import { rekapAggregate, pendapatanHarian, subscriberGrowth, subscriberCumulative, subscriberByProgram } from '../controllers/dashboardController';
const router = Router();

router.get('/rekap-aggregate', rekapAggregate);
router.get('/pendapatan-harian', pendapatanHarian);
router.get('/subscriber-growth/:tahun', subscriberGrowth);
router.get('/subscriber-cumulative/:tahun', subscriberCumulative);
router.get('/subscriber-by-program', subscriberByProgram);

export default router;
