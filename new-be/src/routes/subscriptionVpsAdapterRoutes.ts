import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { authenticate } from '../middleware/authMiddleware';
import {
  createSchedule,
  deleteItem,
  generateDokuPaymentLink,
  generateInvoiceAndMarkProcess,
  generateNextFiscal,
  getAggregateByPeriode,
  getDetailsByPeriode,
  getDetailsByToko,
  getGenerateStatus,
  getLastPeriod,
  listSubscriberTahun,
  rebuildSubscriptionMonthlyRekapEndpoint,
  rebuildSubscriberTahunEndpoint,
  renewSubscriptionNextFiscal,
  searchDetails,
  startGenerateNextFiscal,
  updateItem,
  updateItemActive,
  updateItemStatus,
  uploadInvoicePdfs,
} from '../controllers/subscriptionVpsAdapterController';

const router = Router();
const invoiceUploadDir = path.resolve(__dirname, '..', '..', 'uploads', 'vps-invoices');
fs.mkdirSync(invoiceUploadDir, { recursive: true });
const invoicePdfUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, invoiceUploadDir),
    filename: (_req, file, callback) => {
      const suffix = file.fieldname === 'paid' ? 'lunas' : 'original';
      callback(null, `${Date.now()}-${crypto.randomUUID()}-${suffix}.pdf`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype === 'application/pdf');
  },
});

router.use(authenticate);

router.post('/schedule', createSchedule);
router.get('/details', getDetailsByPeriode);
router.get('/details-search', searchDetails);
router.get('/details-by-toko', getDetailsByToko);
router.get('/aggregate', getAggregateByPeriode);
router.post('/aggregate/rebuild', rebuildSubscriptionMonthlyRekapEndpoint);
router.get('/subscriber-tahun', listSubscriberTahun);
router.post('/subscriber-tahun/rebuild', rebuildSubscriberTahunEndpoint);
router.get('/last-period', getLastPeriod);
router.post('/generate-next-year', generateNextFiscal);
router.post('/renew-next-year', renewSubscriptionNextFiscal);
router.post('/generate-next-year/start', startGenerateNextFiscal);
router.get('/generate-next-year/status', getGenerateStatus);
router.patch('/details/:periode/item/:itemId/status', updateItemStatus);
router.patch('/details/:periode/item/:itemId/active', updateItemActive);
router.patch('/details/:periode/item/:itemId', updateItem);
router.post('/details/:periode/item/:itemId/doku/payment-link', generateDokuPaymentLink);
router.post('/invoice/generate', generateInvoiceAndMarkProcess);
router.post(
  '/invoice/:invoiceNumber/pdf',
  invoicePdfUpload.fields([{ name: 'original', maxCount: 1 }, { name: 'paid', maxCount: 1 }]),
  uploadInvoicePdfs
);
router.post('/details/:periode/item/:itemId/invoice/generate', generateInvoiceAndMarkProcess);
router.delete('/details/:periode/item/:itemId', deleteItem);

export default router;
