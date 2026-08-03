import { Router } from 'express';
import { rekapAggregate, pendapatanHarian, subscriberGrowth, subscriberCumulative, subscriberByProgram, dashboardV2CardData, compareFinanceDaily } from '../controllers/dashboardController';
const router = Router();

router.get('/rekap-aggregate', rekapAggregate);
router.get('/pendapatan-harian', pendapatanHarian);
router.get('/subscriber-growth/:tahun', subscriberGrowth);
router.get('/subscriber-cumulative/:tahun', subscriberCumulative);
router.get('/subscriber-by-program', subscriberByProgram);
router.get('/v2/card-data', dashboardV2CardData);
router.get('/finance-daily-compare', compareFinanceDaily);

export default router;
