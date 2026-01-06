
import { Router } from 'express';
import { createTransaksi, listTransaksi, updateTransaksi, deleteTransaksi, editTransaksiBulanan, deleteTransaksiBulanan, batchCreateTransaksi } from '../controllers/transaksiController';
import { listTtFinanceDetail } from '../controllers/ttFinanceDetailController';
const router = Router();
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

export default router;
