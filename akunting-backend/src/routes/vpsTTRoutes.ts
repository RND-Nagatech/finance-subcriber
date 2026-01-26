import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { createSchedule, deleteItem, getAggregateByPeriode, getDetailsByPeriode, getDetailsByToko, updateItemStatus, updateItem, getLastPeriod, generateNextFiscal, startGenerateNextFiscal, getGenerateStatus, updateItemActive } from '../controllers/vpsTTController2';

const router = Router();

router.use(authenticate);

// Create schedule entries spanning to fiscal end
router.post('/schedule', createSchedule);

// Query details and aggregates for a month
router.get('/details', getDetailsByPeriode);
router.get('/details-by-toko', getDetailsByToko);
router.get('/aggregate', getAggregateByPeriode);
router.get('/last-period', getLastPeriod);
router.post('/generate-next-year', generateNextFiscal);
router.post('/generate-next-year/start', startGenerateNextFiscal);
router.get('/generate-next-year/status', getGenerateStatus);

// Update status or delete an item inside a periode doc
router.patch('/details/:periode/item/:itemId/status', updateItemStatus);
router.patch('/details/:periode/item/:itemId/active', updateItemActive);
router.patch('/details/:periode/item/:itemId', updateItem);
router.delete('/details/:periode/item/:itemId', deleteItem);

export default router;
