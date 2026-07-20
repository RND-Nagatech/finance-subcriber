import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { authenticate } from '../middleware/authMiddleware';
import { createSchedule, deleteItem, generateDokuPaymentLink, generateInvoiceAndMarkProcess, getAggregateByPeriode, getDetailsByPeriode, getDetailsByToko, handleDokuCallbackResult, updateItemStatus, updateItem, getLastPeriod, generateNextFiscal, startGenerateNextFiscal, getGenerateStatus, updateItemActive, uploadInvoicePdfs } from '../controllers/vpsTTController2';

const router = Router();
const invoiceUploadDir = path.join(process.cwd(), 'uploads', 'vps-invoices');
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
router.post(
  '/invoice/:invoiceNumber/pdf',
  invoicePdfUpload.fields([{ name: 'original', maxCount: 1 }, { name: 'paid', maxCount: 1 }]),
  uploadInvoicePdfs
);
router.post('/details/:periode/item/:itemId/invoice/generate', generateInvoiceAndMarkProcess);
router.delete('/details/:periode/item/:itemId', deleteItem);

export default router;
