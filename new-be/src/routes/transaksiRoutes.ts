
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { exportSaldoHarianRekeningExcel, exportTransaksiExcel } from '../controllers/exportExcelController';
import { createTransaksi, listTransaksi, updateTransaksi, deleteTransaksi, editTransaksiBulanan, deleteTransaksiBulanan, batchCreateTransaksi, uploadAttachments, deleteAttachment, validateAttachment, updateValidatorNotes, getRiwayatSaldoRekening, getSaldoRekening, getSaldoHarianRekening } from '../controllers/transaksiController';
import {
  previewSaldoHarianRekening,
  commitSaldoHarianRekening,
  uploadRekeningKoranReconcile,
  getReconcileComparison,
  listReconcileMonths,
} from '../controllers/saldoHarianGeneratorController';
import { authenticate } from '../middleware/authMiddleware';
import { listTtFinanceDetail } from '../controllers/ttFinanceDetailController';

// Pastikan folder uploads/transaksi/ ada
const uploadDir = path.join(process.cwd(), 'uploads', 'transaksi');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const uploadReconcileDir = path.join(process.cwd(), 'uploads', 'rekening-koran');
if (!fs.existsSync(uploadReconcileDir)) {
  fs.mkdirSync(uploadReconcileDir, { recursive: true });
}

const router = Router();
// Export Excel endpoint
router.get('/export-excel', exportTransaksiExcel);

// Validasi data hasil attachment (hanya superuser/corsec)
router.post('/validate-attachment', authenticate, validateAttachment);

// Update validator notes
router.put('/validator-notes', authenticate, updateValidatorNotes);

// Multer config for attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/transaksi/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.mimetype.split('/')[1]);
  }
});
const upload = multer({ storage });
const reconcileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadReconcileDir),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || 'rekening-koran.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const uploadReconcile = multer({ storage: reconcileStorage });

router.get('/tt-finance-detail', listTtFinanceDetail);

router.post('/', createTransaksi);
router.post('/batch', batchCreateTransaksi);
router.get('/', listTransaksi);
router.put('/:id', updateTransaksi);
router.delete('/:id', authenticate, deleteTransaksi);

// Edit nilai data bulanan
router.put('/:id/bulan/:bulan', editTransaksiBulanan);
// Hapus data bulanan
router.delete('/:id/bulan/:bulan', deleteTransaksiBulanan);

// Attachments
router.post('/:id/attachments', upload.array('attachments'), uploadAttachments);
router.delete('/:id/attachments/:filename', authenticate, deleteAttachment);

// Riwayat Saldo Rekening
router.get('/riwayat-saldo-rekening', getRiwayatSaldoRekening);
router.get('/saldo-rekening', getSaldoRekening);
router.get('/saldo-harian-rekening', getSaldoHarianRekening);
router.get('/saldo-harian-rekening/export-excel', exportSaldoHarianRekeningExcel);
router.post('/saldo-harian-rekening/preview', authenticate, previewSaldoHarianRekening);
router.post('/saldo-harian-rekening/commit', authenticate, commitSaldoHarianRekening);
router.post('/saldo-harian-rekening/reconcile/upload', authenticate, uploadReconcile.single('file'), uploadRekeningKoranReconcile);
router.get('/saldo-harian-rekening/reconcile', authenticate, getReconcileComparison);
router.get('/saldo-harian-rekening/reconcile/months', authenticate, listReconcileMonths);

export default router;
