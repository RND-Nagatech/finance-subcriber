import { Router } from 'express';
import { getFiscalYears, getFiscalMonths, getActiveFiscalYear } from '../controllers/fiscalController';

const router = Router();

router.get('/years', getFiscalYears);
router.get('/months', getFiscalMonths);
router.get('/active', getActiveFiscalYear);

export default router;
