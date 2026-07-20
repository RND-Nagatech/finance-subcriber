import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { createSchedule, deleteItem, generateDokuPaymentLink, generateInvoiceAndMarkProcess, getAggregateByPeriode, getDetailsByPeriode, getDetailsByToko, handleDokuCallbackResult, updateItemStatus, updateItem, getLastPeriod, generateNextFiscal, startGenerateNextFiscal, getGenerateStatus, updateItemActive } from '../controllers/vpsTTController2';

const router = Router();

router.get('/doku/result', handleDokuCallbackResult);

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
router.post('/details/:periode/item/:itemId/doku/payment-link', generateDokuPaymentLink);
router.post('/invoice/generate', generateInvoiceAndMarkProcess);
router.post('/details/:periode/item/:itemId/invoice/generate', generateInvoiceAndMarkProcess);
router.delete('/details/:periode/item/:itemId', deleteItem);

export default router;
