
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { exportTransaksiExcel } from '../controllers/exportExcelController';
import { createTransaksi, listTransaksi, updateTransaksi, deleteTransaksi, editTransaksiBulanan, deleteTransaksiBulanan, batchCreateTransaksi, uploadAttachments, deleteAttachment, validateAttachment, updateValidatorNotes, getRiwayatSaldoRekening, getSaldoRekening } from '../controllers/transaksiController';
import { authenticate } from '../middleware/authMiddleware';
import { listTtFinanceDetail } from '../controllers/ttFinanceDetailController';

// Pastikan folder uploads/transaksi/ ada
const uploadDir = path.join(process.cwd(), 'uploads', 'transaksi');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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

router.get('/tt-finance-detail', listTtFinanceDetail);

router.post('/', createTransaksi);
router.post('/batch', batchCreateTransaksi);
router.get('/', listTransaksi);
router.put('/:id', updateTransaksi);
router.delete('/:id', deleteTransaksi);

// Edit nilai data bulanan
router.put('/:id/bulan/:bulan', editTransaksiBulanan);
// Hapus data bulanan
router.delete('/:id/bulan/:bulan', deleteTransaksiBulanan);

// Attachments
router.post('/:id/attachments', upload.array('attachments'), uploadAttachments);
router.delete('/:id/attachments/:filename', deleteAttachment);

// Riwayat Saldo Rekening
router.get('/riwayat-saldo-rekening', getRiwayatSaldoRekening);
router.get('/saldo-rekening', getSaldoRekening);

export default router;
