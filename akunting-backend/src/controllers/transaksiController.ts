import { Request, Response, NextFunction } from 'express';
import Transaksi from '../models/Transaksi';
import ThFinance from '../models/ThFinance';
import FiscalConfig from '../models/FiscalConfig';
import TtFinanceDetail from '../models/TtFinanceDetail';
import TtFinanceDaily from '../models/TtFinanceDaily';
import Rekening from '../models/Rekening';
import RiwayatSaldoRekening from '../models/RiwayatSaldoRekening';
import RekeningSaldoHarian from '../models/RekeningSaldoHarian';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  applyInputDelta,
  applyValidatedDelta,
  calculateSignedDelta,
  hasValidRekeningKey,
} from '../services/rekeningDailyBalanceService';
import {
  createBudgetUsageFromValidatedTransaksi,
  rollbackBudgetUsageFromValidatedTransaksi,
} from '../services/budgetUsageFromTransaksiService';
import {
  applyAssetMovementFromTransaction,
  isAssetSource,
  resolveAssetSnapshot,
  rollbackAssetMovementFromTransaction,
} from '../services/assetLedgerService';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseRupiahSearch(input: string): number | null {
  if (!input) return null;
  const normalized = input
    .replace(/\s+/g, '')
    .replace(/^rp\.?/i, '')
    .replace(/[^0-9,.\-]/g, '');
  if (!normalized) return null;

  let numericStr = normalized;
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  if (hasComma && hasDot) {
    numericStr = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    numericStr = normalized.replace(',', '.');
  } else {
    numericStr = normalized.replace(/\./g, '');
  }

  const value = Number(numericStr);
  return Number.isFinite(value) ? value : null;
}

type TransactionMode = 'NORMAL' | 'SPECIAL' | 'FINANCE_ONLY';

function parseSpecialTransactionFlag(value: any): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeTransactionMode(value: any, fallbackSpecial?: any): TransactionMode {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'SPECIAL' || v === 'FINANCE_ONLY' || v === 'NORMAL') return v as TransactionMode;
  if (parseSpecialTransactionFlag(fallbackSpecial)) return 'SPECIAL';
  return 'NORMAL';
}

function getTransactionMode(doc: any): TransactionMode {
  return normalizeTransactionMode(doc?.transaction_mode, doc?.is_special_transaction);
}

function isSpecialTransaction(doc: any): boolean {
  return getTransactionMode(doc) === 'SPECIAL';
}

function isFinanceOnlyTransaction(doc: any): boolean {
  return getTransactionMode(doc) === 'FINANCE_ONLY';
}

function shouldAffectRekening(doc: any): boolean {
  return !isFinanceOnlyTransaction(doc) && !isAssetSource(doc);
}

function shouldAffectAsset(doc: any): boolean {
  return !isFinanceOnlyTransaction(doc) && isAssetSource(doc);
}

function shouldAffectDashboard(doc: any): boolean {
  return !isSpecialTransaction(doc);
}

function buildRekeningHistoryDescription(doc: any, prefix = ''): string {
  const mode = getTransactionMode(doc);
  const modePrefix =
    mode === 'SPECIAL' ? '[KHUSUS] ' :
    mode === 'FINANCE_ONLY' ? '[FINANCE_ONLY] ' :
    '';
  return `${prefix}${modePrefix}${doc.kategori}/${doc.sub_kategori}/${doc.akun}`;
}

// Validasi data hasil attachment (hanya superuser/corsec)
export const validateAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any; // diasumsikan sudah ada middleware auth, req.user terisi
    if (!user || (user.role !== 'superuser' && user.role !== 'corsec')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { id, validator_notes } = req.body;
    if (!id) return res.status(400).json({ message: 'ID is required' });
    const doc = await TtFinanceDetail.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi detail not found' });
    if (doc.is_validated) {
      return res.status(400).json({ message: 'Transaksi sudah divalidasi, tidak bisa divalidasi ulang.' });
    }

    // Update saldo rekening jika ada rekening
    if (shouldAffectRekening(doc) && doc.kode_bank && doc.no_rekening) {
      const rekening = await Rekening.findOne({ kode_bank: doc.kode_bank, no_rekening: doc.no_rekening });
      if (rekening) {
        const saldoAwal = rekening.saldo;
        let saldoMasuk = 0;
        let saldoKeluar = 0;
        let saldoAkhir = saldoAwal;

        if (doc.kategori === 'PENDAPATAN') {
          saldoMasuk = doc.nilai;
          saldoAkhir += doc.nilai;
        } else {
          saldoKeluar = doc.nilai;
          saldoAkhir -= doc.nilai;
        }

        // Buat riwayat saldo rekening
        const riwayat = new RiwayatSaldoRekening({
          kode_bank: doc.kode_bank,
          no_rekening: doc.no_rekening,
          saldo_awal: saldoAwal,
          saldo_masuk: saldoMasuk,
          saldo_keluar: saldoKeluar,
          saldo_akhir: saldoAkhir,
          transaksi_id: doc._id,
          tanggal: new Date(doc.tanggal),
          keterangan: buildRekeningHistoryDescription(doc)
        });

        await riwayat.save();

        // Update saldo rekening
        rekening.saldo = saldoAkhir;
        await rekening.save();
      }
    }

    const validatorBy = user?.username || user?.email || user?._id || 'SYSTEM';
    const validatorAt = new Date();
    if (shouldAffectAsset(doc)) {
      await applyAssetMovementFromTransaction(doc, validatorBy);
    }
    if (shouldAffectDashboard(doc)) {
      await updateTtFinanceDaily(doc.tanggal, doc.bulan, doc.kategori, doc.sub_kategori, doc.akun, doc.nilai, 'increment', validatorBy, validatorAt);
      await recalculateTransaksiAggregation(doc.kategori, doc.sub_kategori, doc.akun, doc.bulan, doc.nilai, doc.created_by, 'increment');
    }

    // Snapshot saldo harian (jalur validated) dibucket ke tanggal transaksi.
    if (shouldAffectRekening(doc) && hasValidRekeningKey(doc.kode_bank, doc.no_rekening)) {
      const delta = calculateSignedDelta(doc.kategori, Number(doc.nilai || 0));
      await applyValidatedDelta({
        kode_bank: String(doc.kode_bank),
        no_rekening: String(doc.no_rekening),
        tanggal: String(doc.tanggal),
        delta,
        countDelta: 1,
      });
    }

    if (shouldAffectDashboard(doc)) {
      await createBudgetUsageFromValidatedTransaksi({
        doc,
        actor: validatorBy,
      });
    }

    doc.is_validated = true;
    doc.validator_notes = validator_notes || '';
    doc.validator_notes_by = validatorBy;
    doc.validator_notes_at = validatorAt;
    doc.validated_at = validatorAt;
    await doc.save();
    res.json({ success: true, message: 'Validasi berhasil' });
  } catch (error) {
    next(error);
  }
};


// Helper function to update tt_finance_daily
async function updateTtFinanceDaily(tanggal: string, bulan: string, kategori: string, sub_kategori: string, akun: string, nilai: number, operation: 'increment' | 'decrement', inputBy?: string, inputAt?: Date) {
  // Calculate fiscal year from bulan
  let tahunFiskal: string | undefined = undefined;
  if (bulan) {
    const match = bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
    if (match) {
      const bulanStr = match[1].toUpperCase();
      let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
      const bulanMap: Record<string, number> = {
        JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
        JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
      };
      const bulanAngka = bulanMap[bulanStr] || 1;
      tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
    }
  }
  if (!tahunFiskal) return;

  // Format bulan fiskal from tanggal
  const [yyyy, mm, dd] = tanggal.split('-');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthIdx = parseInt(mm, 10) - 1;
  const bulanFiskal = `${monthNames[monthIdx]}-${yyyy.slice(2)}`;

  if (operation === 'increment') {
    const filter = {
      tanggal,
      bulan_fiskal: bulanFiskal,
      tahun_fiskal: tahunFiskal,
      kategori,
      sub_kategori,
      akun
    };

    const existing = await TtFinanceDaily.findOne(filter);
    const nilaiAwal = existing?.total_nilai || 0;

    const updateObj: any = {
      $inc: { total_nilai: nilai },
      $setOnInsert: { created_at: new Date() }
    };

    if (inputBy) {
      updateObj.$push = {
        history: {
          nilai,
          nilai_awal: nilaiAwal,
          tanggal,
          input_by: inputBy,
          input_at: inputAt || new Date(),
          action: 'increment'
        }
      };
    }

    await TtFinanceDaily.findOneAndUpdate(filter, updateObj, { upsert: true, new: true });
  } else if (operation === 'decrement') {
    const filter = {
      tanggal,
      bulan_fiskal: bulanFiskal,
      tahun_fiskal: tahunFiskal,
      kategori,
      sub_kategori,
      akun
    };

    const existing = await TtFinanceDaily.findOne(filter);
    const nilaiAwal = existing?.total_nilai || 0;

    const historyEntry: any = {
      nilai: -Math.abs(nilai),
      nilai_awal: nilaiAwal,
      tanggal,
      input_by: inputBy || '',
      input_at: inputAt || new Date(),
      action: 'decrement'
    };

    await TtFinanceDaily.findOneAndUpdate(
      filter,
      {
        $inc: { total_nilai: -nilai },
        $push: { history: historyEntry },
        $setOnInsert: { created_at: new Date() }
      },
      { upsert: true, new: true }
    );

    const updated = await TtFinanceDaily.findOne(filter);
    if (updated && (updated.total_nilai || 0) < 0) {
      updated.total_nilai = 0;
      await updated.save();
    }
  }
}

async function recalculateTransaksiAggregation(kategori: string, sub_kategori: string, akun: string, bulan: string, nilai: number, input_by: string, operation: 'increment' | 'decrement') {
  // Find tt_finance doc
    let tahunFiskal: string | undefined = undefined;
    if (!tahunFiskal && bulan) {
      const match = bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }
   // Cari dokumen tt_finance hanya berdasarkan kategori, sub_kategori, akun, tahun_fiskal
    let doc = await Transaksi.findOne({ kategori, sub_kategori, akun, tahun_fiskal: tahunFiskal });

    if (!doc) {
      // Buat baru jika belum ada
      const historyEntry: any = {
        bulan,
        nilai: operation === 'increment' ? nilai : -Math.abs(nilai),
        nilai_awal: 0,
        input_by: input_by || '',
        input_at: new Date(),
        action: operation
      };
      doc = new Transaksi({
        kategori,
        sub_kategori,
        akun,
        data_bulanan: [{ bulan, nilai }],
        total_tahunan: nilai,
        input_by,
        tahun_fiskal: tahunFiskal,
        created_at: new Date(),
        updated_at: new Date(),
        history: [historyEntry]
      });
    } else {
      // Update data_bulanan jika sudah ada
      const idx = doc.data_bulanan.findIndex((d: any) => d.bulan === bulan);
      const nilaiAwal = idx >= 0 ? doc.data_bulanan[idx].nilai : 0;
      if (idx >= 0) {
        // SUM nilai jika bulan sudah ada
        doc.data_bulanan[idx].nilai += operation === 'increment' ? nilai : -nilai;
      } else {
        doc.data_bulanan.push({ bulan, nilai });
      }
      // push history entry on setiap perubahan
      const historyEntry: any = {
        bulan,
        nilai: operation === 'increment' ? nilai : -Math.abs(nilai),
        nilai_awal: nilaiAwal,
        input_by: input_by || '',
        input_at: new Date(),
        action: operation
      };
      if (!Array.isArray((doc as any).history)) (doc as any).history = [];
      (doc as any).history.push(historyEntry);
      // Hitung total tahunan
      doc.total_tahunan = doc.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
      doc.updated_at = new Date();
      doc.tahun_fiskal = tahunFiskal || doc.tahun_fiskal;
    }
    await doc.save();
}

export const deleteTransaksi = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted_by = req.body?.deleted_by || req.query?.deleted_by || 'SYSTEM';
    const secret_code = req.body?.secret_code || req.query?.secret_code || '';
    // Find detail
    const detail = await TtFinanceDetail.findById(id);
    if(!detail) return res.status(404).json({ message: 'Transaksi detail not found' });
    const hasRekening = shouldAffectRekening(detail) && hasValidRekeningKey(detail.kode_bank, detail.no_rekening);
    const detailDelta = calculateSignedDelta(detail.kategori, Number(detail.nilai || 0));
    if (detail.is_validated) {
      const user = req.user as any;
      if (!user || user.role !== 'superuser') {
        return res.status(403).json({ message: 'Hanya superuser yang bisa menghapus transaksi tervalidasi.' });
      }

      const expectedSecret = process.env.DELETE_VALIDATED_SECRET_CODE || '';
      if (!expectedSecret) {
        return res.status(500).json({ message: 'Secret code untuk hapus transaksi tervalidasi belum dikonfigurasi.' });
      }

      if (String(secret_code) !== expectedSecret) {
        return res.status(403).json({ message: 'Secret code tidak valid.' });
      }

      const rollbackBy = user?.username || user?.name || user?.email || user?._id || deleted_by || 'SYSTEM';
      const rollbackAt = new Date();

      // Rollback saldo rekening jika transaksi sebelumnya pernah memengaruhi saldo saat validasi.
      if (shouldAffectRekening(detail) && detail.kode_bank && detail.no_rekening) {
        const rekening = await Rekening.findOne({ kode_bank: detail.kode_bank, no_rekening: detail.no_rekening });
        if (rekening) {
          const saldoAwal = rekening.saldo;
          let saldoMasuk = 0;
          let saldoKeluar = 0;
          let saldoAkhir = saldoAwal;

          if (detail.kategori === 'PENDAPATAN') {
            saldoKeluar = detail.nilai;
            saldoAkhir -= detail.nilai;
          } else {
            saldoMasuk = detail.nilai;
            saldoAkhir += detail.nilai;
          }

          const riwayat = new RiwayatSaldoRekening({
            kode_bank: detail.kode_bank,
            no_rekening: detail.no_rekening,
            saldo_awal: saldoAwal,
            saldo_masuk: saldoMasuk,
            saldo_keluar: saldoKeluar,
            saldo_akhir: saldoAkhir,
            transaksi_id: detail._id,
            tanggal: new Date(detail.tanggal),
            keterangan: buildRekeningHistoryDescription(detail, '[DELETE VALIDATED] ')
          });

          await riwayat.save();
          rekening.saldo = saldoAkhir;
          await rekening.save();
        }
      }
      if (shouldAffectAsset(detail)) {
        await rollbackAssetMovementFromTransaction(detail, rollbackBy);
      }

      if (shouldAffectDashboard(detail)) {
        await updateTtFinanceDaily(
          detail.tanggal,
          detail.bulan,
          detail.kategori,
          detail.sub_kategori,
          detail.akun,
          detail.nilai,
          'decrement',
          rollbackBy,
          rollbackAt
        );
        await recalculateTransaksiAggregation(
          detail.kategori,
          detail.sub_kategori,
          detail.akun,
          detail.bulan,
          detail.nilai,
          rollbackBy,
          'decrement'
        );
        await rollbackBudgetUsageFromValidatedTransaksi({
          transaksiId: String(detail._id),
          actor: rollbackBy,
        });
      }
    }

    // Rollback snapshot saldo harian:
    // - jalur input: selalu rollback saat transaksi dihapus.
    // - jalur validated: rollback hanya jika transaksi sudah tervalidasi.
    if (hasRekening) {
      await applyInputDelta({
        kode_bank: String(detail.kode_bank),
        no_rekening: String(detail.no_rekening),
        tanggal: String(detail.tanggal),
        delta: -detailDelta,
        countDelta: -1,
      });

      if (detail.is_validated) {
        await applyValidatedDelta({
          kode_bank: String(detail.kode_bank),
          no_rekening: String(detail.no_rekening),
          tanggal: String(detail.tanggal),
          delta: -detailDelta,
          countDelta: -1,
        });
      }
    }

    // Soft delete: set status_deleted, deleted_at, deleted_by
    detail.status_deleted = true;
    detail.deleted_at = new Date();
    detail.deleted_by = deleted_by;
    await detail.save();

    res.json({ success: true, message: 'Transaksi soft deleted', detail });
  } catch (error) {
    next(error);
  }
};
// Edit data bulanan pada transaksi
export const editTransaksiBulanan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, bulan } = req.params;
    const { nilai } = req.body;
    const doc = await Transaksi.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi not found' });
    const idx = doc.data_bulanan.findIndex((d: any) => d.bulan === bulan);
    if (idx === -1) return res.status(404).json({ message: 'Bulan not found' });
    doc.data_bulanan[idx].nilai = nilai;
    doc.total_tahunan = doc.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
    doc.updated_at = new Date();
    await doc.save();
    res.json(doc);
  } catch (error) {
    next(error);
  }
};

// Hapus data bulanan pada transaksi
export const deleteTransaksiBulanan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, bulan } = req.params;
    const doc = await Transaksi.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi not found' });
    doc.data_bulanan = doc.data_bulanan.filter((d: any) => d.bulan !== bulan);
    doc.total_tahunan = doc.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
    doc.updated_at = new Date();
    await doc.save();
    res.json(doc);
  } catch (error) {
    next(error);
  }
};

// Upload attachments for transaksi
export const uploadAttachments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

    const doc = await TtFinanceDetail.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi not found' });

    const newAttachments = files.map(file => ({
      path: `/uploads/transaksi/${file.filename}`
    }));
    doc.attachments = [...(doc.attachments || []), ...newAttachments];
    doc.updated_at = new Date();
    await doc.save();



    res.json({ success: true, attachments: doc.attachments });
  } catch (error) {
    next(error);
  }
};

// Delete attachment from transaksi
export const deleteAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, filename } = req.params;
    const doc = await TtFinanceDetail.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi not found' });

    // Filter out the attachment to be deleted
    const filteredAttachments = (doc.attachments || []).filter(att => !att.path.includes(filename));
    const wasLastAttachment = (doc.attachments || []).length > 0 && filteredAttachments.length === 0;

    doc.attachments = filteredAttachments;
    doc.updated_at = new Date();
    await doc.save();

    // If this was the last attachment, update tt_finance_daily
    if (wasLastAttachment && shouldAffectDashboard(doc)) {
      const user = req.user as any;
      const inputBy = user?.username || user?.email || doc.deleted_by || 'SYSTEM';
      const inputAt = new Date();
      await updateTtFinanceDaily(doc.tanggal, doc.bulan, doc.kategori, doc.sub_kategori, doc.akun, doc.nilai, 'decrement', inputBy, inputAt);
      await recalculateTransaksiAggregation(doc.kategori, doc.sub_kategori, doc.akun, doc.bulan, doc.nilai, doc.created_by, 'decrement');
    }

    res.json({ success: true, attachments: doc.attachments });
  } catch (error) {
    next(error);
  }
};


export const createTransaksi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kategori, sub_kategori, akun, bulan, nilai, input_by, tahun_fiskal, tanggal, keterangan, kode_perusahaan, nama_perusahaan, kode_bank, no_rekening, is_special_transaction, transaction_mode, source_type, asset_id, asset_qty } = req.body;
    if (!kategori || !sub_kategori || !akun || !bulan || nilai === undefined) {
      return res.status(400).json({ message: 'kategori, sub_kategori, akun, bulan, nilai required' });
    }
    // --- Fiscal year validation ---
    // Get fiscal year from bulan or tahun_fiskal
    let fiscalYearInput = tahun_fiskal;
    if (!fiscalYearInput && bulan) {
      const match = bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        fiscalYearInput = bulanAngka >= 12 ? (tahunNum + 1) : tahunNum;
      }
    }
    // Get active year from FiscalConfig
    const fiscalConfig = await FiscalConfig.findOne({ key: 'fiscal' });
    const activeYear = fiscalConfig?.active_year ? Number(fiscalConfig.active_year) : null;
    if (activeYear !== null && Number(fiscalYearInput) > activeYear) {
      return res.status(400).json({ message: `Tahun fiskal ${fiscalYearInput} melebihi tahun aktif ${activeYear}. Input/edit ditolak.` });
    }
    // Otomatis ambil tahun fiskal dari bulan jika tidak dikirim
    let tahunFiskal = tahun_fiskal;
    if (!tahunFiskal && bulan) {
      // Format bulan: "APR - 25" → bulan=APR, tahun=25
      const match = bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        // Map bulan ke angka
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        // Aturan fiskal: Desember (12) → tahun fiskal = tahun+1, Jan–Nov → tahun fiskal = tahun
        tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }
    if (!tahunFiskal) {
      return res.status(400).json({ message: 'tahun_fiskal tidak ditemukan dari bulan' });
    }
    const transactionMode = normalizeTransactionMode(transaction_mode, is_special_transaction);
    const sourceType = String(source_type || 'REKENING').toUpperCase() === 'ASSET' ? 'ASSET' : 'REKENING';
    let assetSnapshot: any = null;
    if (sourceType === 'ASSET') {
      const qty = Number(asset_qty || 0);
      if (!asset_id || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ message: 'asset_id dan asset_qty wajib diisi untuk transaksi asset.' });
      }
      assetSnapshot = await resolveAssetSnapshot(String(asset_id));
    }

    // Simpan detail transaksi ke tt_finance_detail
    // tanggal HARUS diambil dari input (bukan tanggal input), dan WAJIB ADA
    if (!tanggal) {
      return res.status(400).json({ message: 'tanggal (tanggal transaksi) wajib diisi' });
    }
    const detail = new TtFinanceDetail({
      tanggal: tanggal,
      bulan,
      kategori,
      sub_kategori,
      akun,
      nilai,
      keterangan: keterangan && keterangan.trim() !== '' ? keterangan.toUpperCase() : '-',
      created_by: input_by,
      created_at: new Date(),
      kode_perusahaan: kode_perusahaan || '',
      nama_perusahaan: nama_perusahaan || '',
      kode_bank: sourceType === 'ASSET' ? '-' : (kode_bank && kode_bank.trim() !== '' ? kode_bank : '-'),
      no_rekening: sourceType === 'ASSET' ? '-' : (no_rekening && no_rekening.trim() !== '' ? no_rekening : '-'),
      source_type: sourceType,
      asset_id: sourceType === 'ASSET' ? assetSnapshot.asset._id : undefined,
      asset_code: sourceType === 'ASSET' ? assetSnapshot.asset_code : undefined,
      asset_name: sourceType === 'ASSET' ? assetSnapshot.asset_name : undefined,
      asset_qty: sourceType === 'ASSET' ? Number(asset_qty) : undefined,
      asset_unit: sourceType === 'ASSET' ? assetSnapshot.unit : undefined,
      asset_unit_price_snapshot: sourceType === 'ASSET' ? assetSnapshot.current_price : undefined,
      tahun_fiskal,
      is_special_transaction: transactionMode === 'SPECIAL',
      transaction_mode: transactionMode,
    });

    await detail.save();

    // Snapshot saldo harian (jalur input) langsung masuk saat transaksi dibuat.
    if (shouldAffectRekening(detail) && hasValidRekeningKey(detail.kode_bank, detail.no_rekening)) {
      const delta = calculateSignedDelta(detail.kategori, Number(detail.nilai || 0));
      await applyInputDelta({
        kode_bank: String(detail.kode_bank),
        no_rekening: String(detail.no_rekening),
        tanggal: String(detail.tanggal),
        delta,
        countDelta: 1,
      });
    }

    res.json(detail);
  } catch (error) {
    next(error);
  }
};

export const listTransaksi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tahun, bulan, kategori, sub_kategori, akun, input_by, page = '1', limit = '10', flatten = '0', sortKategori, q, special_type } = req.query as any;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const doFlatten = String(flatten) === '1' || String(flatten).toLowerCase() === 'true';
    const filter: any = {};
    if (tahun) filter.tahun_fiskal = tahun;
    if (kategori && kategori !== 'ALL') filter.kategori = kategori;
    if (sub_kategori && sub_kategori !== 'ALL') filter.sub_kategori = sub_kategori;
    if (akun && akun !== 'ALL') filter.akun = akun;
    if (input_by && input_by !== 'ALL') filter.input_by = input_by;
    if (special_type === 'SPECIAL') filter.transaction_mode = 'SPECIAL';
    if (special_type === 'FINANCE_ONLY') filter.transaction_mode = 'FINANCE_ONLY';
    if (special_type === 'NORMAL') {
      filter.$and = [
        {
          $or: [
            { transaction_mode: 'NORMAL' },
            { transaction_mode: { $exists: false }, is_special_transaction: { $ne: true } },
          ],
        },
      ];
    }

    // Determine which collection to use (Transaksi or ThFinance)
    let Model: any = Transaksi;
    if (tahun) {
      const fiscalConfig = await FiscalConfig.findOne({ key: 'fiscal' });
      if (fiscalConfig && Number(tahun) < Number(fiscalConfig.active_year)) {
        Model = ThFinance;
      }
    }

    if (doFlatten) {
      // Aggregate to return flattened data_bulanan rows with pagination
      const matchStage = Object.keys(filter).length ? [{ $match: filter }] : [];
      // Unwind and project useful fields
      const sortStage: any = {};
      if (sortKategori === 'asc') sortStage.kategori = 1;
      else if (sortKategori === 'desc') sortStage.kategori = -1;
      sortStage.akun = 1;
      sortStage.sub_kategori = 1;
      sortStage.bulan = 1;
      const bulanStr = bulan ? String(bulan) : null;
      const qText = q && String(q).trim() !== '' ? String(q).trim() : '';
      const qRegex = qText ? escapeRegex(qText) : '';
      const qAmount = qText ? parseRupiahSearch(qText) : null;
      const searchMatchStage = qText
        ? [{
            $match: {
              $or: [
                { kategori: { $regex: qRegex, $options: 'i' } },
                { sub_kategori: { $regex: qRegex, $options: 'i' } },
                { akun: { $regex: qRegex, $options: 'i' } },
                { source_type: { $regex: qRegex, $options: 'i' } },
                { asset_code: { $regex: qRegex, $options: 'i' } },
                { asset_name: { $regex: qRegex, $options: 'i' } },
                { 'data_bulanan.bulan': { $regex: qRegex, $options: 'i' } },
                ...(qAmount !== null ? [{ 'data_bulanan.nilai': qAmount }] : []),
              ],
            },
          }]
        : [];
      const pipeline: any[] = [
        ...matchStage,
        { $unwind: '$data_bulanan' },
        ...(bulanStr ? [{ $match: { $or: [
          { 'data_bulanan.bulan': bulanStr },
          { 'data_bulanan.bulan': bulanStr.replace(/\s*-\s*/, '-') },
          { 'data_bulanan.bulan': bulanStr.replace(/\s*-\s*/, ' - ') }
        ] } }] : []),
        ...searchMatchStage,
        {
          $project: {
            kategori: 1,
            sub_kategori: 1,
            akun: 1,
            input_by: 1,
            tahun_fiskal: 1,
            bulan: '$data_bulanan.bulan',
            nilai: '$data_bulanan.nilai',
            parentId: '$_id',
          },
        },
        { $sort: sortStage },
        {
          $facet: {
            pagedResults: [
              { $skip: (pageNum - 1) * limitNum },
              { $limit: limitNum },
            ],
            totalCount: [
              { $count: 'count' }
            ],
            totalSum: [
              { $group: { _id: null, sum: { $sum: '$nilai' } } }
            ]
          }
        }
      ];

      const aggRes = await Model.aggregate(pipeline).allowDiskUse(true).exec();
      const paged = aggRes[0]?.pagedResults || [];
      const total = (aggRes[0]?.totalCount && aggRes[0].totalCount[0] && aggRes[0].totalCount[0].count) || 0;
      const totalSum = (aggRes[0]?.totalSum && aggRes[0].totalSum[0] && aggRes[0].totalSum[0].sum) || 0;
      const totalPages = Math.ceil(total / limitNum) || 1;
      return res.json({ data: paged, total, totalNilai: totalSum, page: pageNum, totalPages });
    }

    // Default: return paginated documents (grouped per transaksi)
    // Apply free-text search (q) on top-level fields for grouped results
    const searchFilter = (() => {
      if (q && String(q).trim() !== '') {
        const qText = String(q).trim();
        const rx = new RegExp(escapeRegex(qText), 'i');
        const amount = parseRupiahSearch(qText);
        return { $or: [
          { kategori: rx },
          { sub_kategori: rx },
          { akun: rx },
          ...(amount !== null ? [{ total_tahunan: amount }] : []),
        ] };
      }
      return {};
    })();
    const finalFilter = Object.keys(searchFilter).length ? { $and: [filter, searchFilter] } : filter;

    // Counts and sums should respect finalFilter
    const total = await Model.countDocuments(finalFilter);
    const totalPages = Math.ceil(total / limitNum) || 1;
    const sumAgg = await Model.aggregate([
      { $match: finalFilter },
      { $group: { _id: null, sum: { $sum: '$total_tahunan' } } }
    ]).exec();
    const totalSum = sumAgg[0]?.sum || 0;

    const sortObj: any = {};
    if (sortKategori === 'asc') sortObj.kategori = 1;
    else if (sortKategori === 'desc') sortObj.kategori = -1;
    sortObj.akun = 1;
    sortObj.sub_kategori = 1;
    sortObj._id = 1; // Stable tiebreaker

    const list = await Model.find(finalFilter)
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    res.json({ data: list, total, totalNilai: totalSum, page: pageNum, totalPages });
  } catch (error) {
    next(error);
  }
};

export const updateTransaksi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { kategori, sub_kategori, akun, bulan, nilai, input_by, tahun_fiskal, tanggal, keterangan, kode_perusahaan, nama_perusahaan, kode_bank, no_rekening, is_special_transaction, transaction_mode, source_type, asset_id, asset_qty } = req.body;
    // Cari detail transaksi di tt_finance_detail
    const detail = await TtFinanceDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Transaksi detail not found' });
    if (detail.is_validated) {
      return res.status(400).json({ message: 'Transaksi sudah divalidasi, tidak bisa diedit.' });
    }
    // --- Fiscal year validation for update ---
    // Determine fiscal year from new bulan or tahun_fiskal
    let fiscalYearInput = tahun_fiskal;
    let bulanInput = bulan || detail.bulan;
    if (!fiscalYearInput && bulanInput) {
      const match = bulanInput.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        fiscalYearInput = bulanAngka >= 12 ? (tahunNum + 1) : tahunNum;
      }
    }
    // Get active year from FiscalConfig
    const fiscalConfig = await FiscalConfig.findOne({ key: 'fiscal' });
    const activeYear = fiscalConfig?.active_year ? Number(fiscalConfig.active_year) : null;
    if (activeYear !== null && Number(fiscalYearInput) > activeYear) {
      return res.status(400).json({ message: `Tahun fiskal ${fiscalYearInput} melebihi tahun aktif ${activeYear}. Input/edit ditolak.` });
    }

    // Save old values before update (declare only once)
    const oldKategori = detail.kategori;
    const oldSubKategori = detail.sub_kategori;
    const oldAkun = detail.akun;
    const oldBulan = detail.bulan;
    const oldNilai = detail.nilai;
    const oldTanggal = detail.tanggal; // simpan tanggal lama sebelum update
    const oldKodeBank = detail.kode_bank;
    const oldNoRekening = detail.no_rekening;
    const oldAffectRekening = shouldAffectRekening(detail);
    const oldAffectDashboard = shouldAffectDashboard(detail);
    const newTransactionMode = normalizeTransactionMode(
      transaction_mode ?? detail.transaction_mode,
      is_special_transaction ?? detail.is_special_transaction
    );
    const newSourceType = String(source_type || detail.source_type || 'REKENING').toUpperCase() === 'ASSET' ? 'ASSET' : 'REKENING';
    const newAffectRekening = newTransactionMode !== 'FINANCE_ONLY' && newSourceType !== 'ASSET';
    const newAffectDashboard = newTransactionMode !== 'SPECIAL';
    let assetSnapshot: any = null;
    if (newSourceType === 'ASSET') {
      const qty = Number(asset_qty !== undefined ? asset_qty : detail.asset_qty || 0);
      const targetAssetId = asset_id || detail.asset_id;
      if (!targetAssetId || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ message: 'asset_id dan asset_qty wajib diisi untuk transaksi asset.' });
      }
      assetSnapshot = await resolveAssetSnapshot(String(targetAssetId));
    }
    const oldTahunFiskal = tahun_fiskal || (() => {
      const match = detail.bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        return bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
      return undefined;
    })();

    // 1. Soft delete old detail
    detail.status_deleted = true;
    detail.deleted_at = new Date();
    detail.deleted_by = input_by || 'SYSTEM';
    await detail.save();

    // 2. Decrement/rekap tt_finance_daily untuk tanggal lama (aggregate ulang)
    if (oldAffectDashboard && oldTanggal && oldKategori && oldSubKategori && oldAkun && oldBulan && oldNilai && oldTahunFiskal) {
      const [yyyyOld, mmOld, ddOld] = oldTanggal.split('-');
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const monthIdxOld = parseInt(mmOld, 10) - 1;
      const bulanFiskalOld = `${monthNames[monthIdxOld]}-${yyyyOld.slice(2)}`;
      // Aggregate ulang nilai detail yang status_deleted=false
      const sumDetail = await TtFinanceDetail.aggregate([
        { $match: {
            tanggal: oldTanggal,
            kategori: oldKategori,
            sub_kategori: oldSubKategori,
            akun: oldAkun,
            status_deleted: { $ne: true },
            is_special_transaction: { $ne: true }
        } },
        { $group: { _id: null, total: { $sum: "$nilai" } } }
      ]);
      const totalNilaiBaru = sumDetail[0]?.total || 0;
      const dailyFilter = {
        tanggal: oldTanggal,
        bulan_fiskal: bulanFiskalOld,
        tahun_fiskal: oldTahunFiskal,
        kategori: oldKategori,
        sub_kategori: oldSubKategori,
        akun: oldAkun,
      };
      const existingDaily = await TtFinanceDaily.findOne(dailyFilter);

      // Re-aggregate via $set must also write history delta so audit trail stays consistent.
      if (existingDaily) {
        const nilaiAwalDaily = Number(existingDaily.total_nilai || 0);
        const delta = Number(totalNilaiBaru) - nilaiAwalDaily;
        const updateObj: any = {
          $set: { total_nilai: totalNilaiBaru },
        };
        if (delta !== 0) {
          updateObj.$push = {
            history: {
              nilai: delta,
              nilai_awal: nilaiAwalDaily,
              tanggal: oldTanggal,
              input_by: input_by || 'SYSTEM',
              input_at: new Date(),
              action: delta >= 0 ? 'increment' : 'decrement',
            },
          };
        }
        await TtFinanceDaily.findOneAndUpdate(dailyFilter, updateObj, { new: true });
      } else if (totalNilaiBaru > 0) {
        await TtFinanceDaily.create({
          ...dailyFilter,
          total_nilai: totalNilaiBaru,
          created_at: new Date(),
          history: [
            {
              nilai: totalNilaiBaru,
              nilai_awal: 0,
              tanggal: oldTanggal,
              input_by: input_by || 'SYSTEM',
              input_at: new Date(),
              action: 'increment',
            },
          ],
        });
      }
    }

    // Hitung tahun fiskal dari bulan baru
    let tahunFiskal = tahun_fiskal;
    if (!tahunFiskal && detail.bulan) {
      const match = detail.bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }

    // 2. Create new detail (like add)
    const newDetail = new TtFinanceDetail({
      tanggal: tanggal || detail.tanggal,
      bulan: bulan || detail.bulan,
      kategori: kategori || detail.kategori,
      sub_kategori: sub_kategori || detail.sub_kategori,
      akun: akun || detail.akun,
      nilai: nilai !== undefined ? nilai : detail.nilai,
      keterangan: keterangan && keterangan.trim() !== '' ? keterangan.toUpperCase() : '-',
      created_by: input_by || detail.created_by,
      created_at: new Date(),
      kode_perusahaan: kode_perusahaan || '',
      nama_perusahaan: nama_perusahaan || '',
      kode_bank: newSourceType === 'ASSET' ? '-' : (kode_bank && kode_bank.trim() !== '' ? kode_bank : '-'),
      no_rekening: newSourceType === 'ASSET' ? '-' : (no_rekening && no_rekening.trim() !== '' ? no_rekening : '-'),
      source_type: newSourceType,
      asset_id: newSourceType === 'ASSET' ? assetSnapshot.asset._id : undefined,
      asset_code: newSourceType === 'ASSET' ? assetSnapshot.asset_code : undefined,
      asset_name: newSourceType === 'ASSET' ? assetSnapshot.asset_name : undefined,
      asset_qty: newSourceType === 'ASSET' ? Number(asset_qty !== undefined ? asset_qty : detail.asset_qty || 0) : undefined,
      asset_unit: newSourceType === 'ASSET' ? assetSnapshot.unit : undefined,
      asset_unit_price_snapshot: newSourceType === 'ASSET' ? assetSnapshot.current_price : undefined,
      is_special_transaction: newTransactionMode === 'SPECIAL',
      transaction_mode: newTransactionMode,
      attachments: detail.attachments && detail.attachments.length > 0 ? [...detail.attachments] : [],
    });
    await newDetail.save();

    // Snapshot saldo harian (jalur input):
    // rollback kontribusi transaksi lama, lalu apply transaksi baru.
    if (oldAffectRekening && hasValidRekeningKey(oldKodeBank, oldNoRekening)) {
      const oldDelta = calculateSignedDelta(oldKategori, Number(oldNilai || 0));
      await applyInputDelta({
        kode_bank: String(oldKodeBank),
        no_rekening: String(oldNoRekening),
        tanggal: String(oldTanggal),
        delta: -oldDelta,
        countDelta: -1,
      });
    }
    if (newAffectRekening && hasValidRekeningKey(newDetail.kode_bank, newDetail.no_rekening)) {
      const newDelta = calculateSignedDelta(String(newDetail.kategori || ''), Number(newDetail.nilai || 0));
      await applyInputDelta({
        kode_bank: String(newDetail.kode_bank),
        no_rekening: String(newDetail.no_rekening),
        tanggal: String(newDetail.tanggal),
        delta: newDelta,
        countDelta: 1,
      });
    }

    // 3. Update tt_finance aggregation for old and new bulan
    // Find doc for old values
    let tahunFiskalOld = oldTahunFiskal;
    let docOld = null;
    if (tahunFiskalOld) {
      docOld = await Transaksi.findOne({ kategori: oldKategori, sub_kategori: oldSubKategori, akun: oldAkun, tahun_fiskal: tahunFiskalOld });
    }
    if (!docOld) {
      docOld = await Transaksi.findOne({ kategori: oldKategori, sub_kategori: oldSubKategori, akun: oldAkun });
      if (docOld) tahunFiskalOld = docOld.tahun_fiskal;
    }
    if (oldAffectDashboard && docOld) {
      // Only sum nilai where status_deleted != true
      const sumOld = await TtFinanceDetail.aggregate([
        { $match: {
          kategori: oldKategori,
          sub_kategori: oldSubKategori,
          akun: oldAkun,
          bulan: oldBulan,
          status_deleted: { $ne: true },
          is_special_transaction: { $ne: true }
        } },
        { $group: { _id: null, total: { $sum: "$nilai" } } }
      ]);
      const totalBulanOld = sumOld[0]?.total || 0;
      const idxOld = docOld.data_bulanan.findIndex((d: any) => d.bulan === oldBulan);
      if (idxOld >= 0) {
        if (totalBulanOld > 0) {
          docOld.data_bulanan[idxOld].nilai = totalBulanOld;
        } else {
          docOld.data_bulanan.splice(idxOld, 1);
        }
      }
      docOld.total_tahunan = docOld.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
      docOld.updated_at = new Date();
      await docOld.save();
    }

    // HAPUS seluruh blok berikut:
    // Update/create docNew untuk new values (tt_finance)
    // const sumNew = await TtFinanceDetail.aggregate([...]);
    // const totalBulanNew = sumNew[0]?.total || 0;
    // if (docNew) { ... } else { ... }

    // Find doc for new values
    let tahunFiskalNew = tahun_fiskal;
    let docNew = null;
    // Pastikan tahunFiskalNew selalu terisi dari bulan baru ATAU bulan lama detail
    const bulanRef = bulan || detail.bulan;
    if (!tahunFiskalNew && bulanRef) {
      const match = bulanRef.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        tahunFiskalNew = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }
    if (newAffectDashboard && tahunFiskalNew) {
      docNew = await Transaksi.findOne({ kategori: kategori || detail.kategori, sub_kategori: sub_kategori || detail.sub_kategori, akun: akun || detail.akun, tahun_fiskal: tahunFiskalNew });
    }
    if (newAffectDashboard && !docNew) {
      docNew = await Transaksi.findOne({ kategori: kategori || detail.kategori, sub_kategori: sub_kategori || detail.sub_kategori, akun: akun || detail.akun });
      if (docNew) tahunFiskalNew = docNew.tahun_fiskal;
    }
    // Always aggregate and update/create docNew for new values
    // const sumNew = await TtFinanceDetail.aggregate([...]);
    // const totalBulanNew = sumNew[0]?.total || 0;
    // if (docNew) { ... } else { ... }

    // Buat dokumen baru jika belum ada
    if (!tahunFiskalNew) {
      // Safety net: derive from bulan detail jika masih kosong
      const match = (bulan || detail.bulan)?.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        tahunFiskalNew = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }

    if (newAffectDashboard && !tahunFiskalNew) {
      return res.status(400).json({ message: 'Gagal menentukan tahun_fiskal untuk transaksi baru.' });
    }
    // const newTransaksi = new Transaksi({
    //   kategori: kategori || detail.kategori,
    //   sub_kategori: sub_kategori || detail.sub_kategori,
    //   akun: akun || detail.akun,
    //   data_bulanan: [{ bulan: bulan || detail.bulan, nilai: totalBulanNew }],
    //   total_tahunan: totalBulanNew,
    //   input_by: input_by || detail.created_by || 'system',
    //   tahun_fiskal: tahunFiskalNew,
    //   created_at: new Date(),
    //   updated_at: new Date(),
    // });
    // await newTransaksi.save();

    res.json({ old_detail: detail, new_detail: newDetail });
  } catch (error) {
    next(error);
  }
};

// Batch insert transaksi - menerima array of transaksi objects
export const batchCreateTransaksi = async (req: Request, res: Response, next: NextFunction) => {
    // Get active year from FiscalConfig (sekali saja)
    const fiscalConfig = await FiscalConfig.findOne({ key: 'fiscal' });
    const activeYear = fiscalConfig?.active_year ? Number(fiscalConfig.active_year) : null;
  try {
    const transaksiArray = req.body;

    // Validasi input harus berupa array
    if (!Array.isArray(transaksiArray)) {
      return res.status(400).json({ message: 'Input harus berupa array of transaksi objects' });
    }

    // Validasi array tidak kosong
    if (transaksiArray.length === 0) {
      return res.status(400).json({ message: 'Array transaksi tidak boleh kosong' });
    }

    const results = {
      success: [] as any[],
      errors: [] as any[],
      total: transaksiArray.length,
      successCount: 0,
      errorCount: 0
    };

    // Process each transaksi item
    for (let i = 0; i < transaksiArray.length; i++) {
      const item = transaksiArray[i];
      const itemIndex = i + 1;

      try {
        const { kategori, sub_kategori, akun, bulan, nilai, input_by, tahun_fiskal } = item;

        // Validasi required fields
        if (!kategori || !sub_kategori || !akun || !bulan || nilai === undefined) {
          results.errors.push({
            index: itemIndex,
            data: item,
            error: 'kategori, sub_kategori, akun, bulan, nilai required'
          });
          results.errorCount++;
          continue;
          // ...existing code...
        }

        // Derive tahun fiskal dari input atau dari bulan (DEC -> tahun+1; lainnya -> tahun)
        let tahunFiskal: string | undefined = tahun_fiskal;
        if (!tahunFiskal && bulan) {
          const match = String(bulan).match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
          if (match) {
            const bulanStr = match[1].toUpperCase();
            let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
            const bulanMap: Record<string, number> = {
              JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
              JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
            };
            const bulanAngka = bulanMap[bulanStr] || 1;
            tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
          }
        }
        if (!tahunFiskal) {
          throw new Error('tahun_fiskal tidak dapat ditentukan dari bulan');
        }

        // Cari dokumen tt_finance berdasarkan kategori, sub_kategori, akun, tahun_fiskal
        let doc = await Transaksi.findOne({ kategori, sub_kategori, akun, tahun_fiskal: tahunFiskal });

        if (!doc) {
          // Buat baru jika belum ada
          doc = new Transaksi({
            kategori,
            sub_kategori,
            akun,
            data_bulanan: [{ bulan, nilai }],
            total_tahunan: nilai,
            input_by: input_by || 'system',
            tahun_fiskal: tahunFiskal,
            created_at: new Date(),
            updated_at: new Date(),
          });
        } else {
          // Update data_bulanan jika sudah ada
          const idx = doc.data_bulanan.findIndex((d: any) => d.bulan === bulan);
          if (idx >= 0) {
            doc.data_bulanan[idx].nilai = nilai;
          } else {
            doc.data_bulanan.push({ bulan, nilai });
          }
          // Hitung total tahunan
          doc.total_tahunan = doc.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
          doc.updated_at = new Date();
          doc.tahun_fiskal = tahunFiskal;
        }

        await doc.save();
        results.success.push({
          index: itemIndex,
          data: item,
          result: doc
        });
        results.successCount++;

      } catch (itemError) {
        results.errors.push({
          index: itemIndex,
          data: item,
          error: itemError instanceof Error ? itemError.message : 'Unknown error'
        });
        results.errorCount++;
      }
    }

    // Return summary
    const statusCode = results.errorCount === 0 ? 200 : results.errorCount === results.total ? 400 : 207; // 207 = Multi-Status

    res.status(statusCode).json({
      message: `Batch insert completed. Success: ${results.successCount}, Errors: ${results.errorCount}`,
      results
    });

  } catch (error) {
    next(error);
  }
};

// Get riwayat saldo rekening
export const getRiwayatSaldoRekening = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kode_bank, no_rekening, start_date, end_date, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};
    if (kode_bank) filter.kode_bank = kode_bank;
    if (no_rekening) filter.no_rekening = no_rekening;
    
    // Filter by date range
    if (start_date || end_date) {
      filter.tanggal = {};
      if (start_date) {
        filter.tanggal.$gte = new Date(start_date as string);
      }
      if (end_date) {
        filter.tanggal.$lte = new Date(end_date as string + 'T23:59:59.999Z'); // End of day
      }
    }

    const total = await RiwayatSaldoRekening.countDocuments(filter);
    const riwayat = await RiwayatSaldoRekening.find(filter)
      .sort({ createdAt: -1 }) // Sort by createdAt descending (paling lama di atas)
      .skip(skip)
      .limit(limitNum);

    res.json(riwayat);
  } catch (error) {
    next(error);
  }
};

// Get saldo rekening saat ini
export const getSaldoRekening = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kode_bank, no_rekening } = req.query;

    if (!kode_bank || !no_rekening) {
      return res.status(400).json({ message: 'kode_bank dan no_rekening diperlukan' });
    }

    const rekening = await Rekening.findOne({
      kode_bank: kode_bank,
      no_rekening: no_rekening
    }).populate('bank_id', 'nama_bank');

    if (!rekening) {
      return res.status(404).json({ message: 'Rekening tidak ditemukan' });
    }

    res.json({
      kode_bank: rekening.kode_bank,
      no_rekening: rekening.no_rekening,
      saldo: rekening.saldo,
      nama_rekening: rekening.nama_rekening,
      nama_bank: rekening.bank_id ? (rekening.bank_id as any).nama_bank : rekening.kode_bank
    });
  } catch (error) {
    next(error);
  }
};

// Get saldo harian rekening (dual basis: input vs validated)
export const getSaldoHarianRekening = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kode_bank, no_rekening, start_date, end_date, page = '1', limit = '31' } = req.query;
    if (!kode_bank || !no_rekening) {
      return res.status(400).json({ message: 'kode_bank dan no_rekening diperlukan' });
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(365, parseInt(String(limit), 10) || 31));
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {
      kode_bank: String(kode_bank),
      no_rekening: String(no_rekening),
    };
    if (start_date || end_date) {
      filter.tanggal = {};
      if (start_date) filter.tanggal.$gte = String(start_date);
      if (end_date) filter.tanggal.$lte = String(end_date);
    }

    const total = await RekeningSaldoHarian.countDocuments(filter);
    const summaryAgg = await RekeningSaldoHarian.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total_debit_input: { $sum: { $ifNull: ['$debit_input', 0] } },
          total_credit_input: { $sum: { $ifNull: ['$credit_input', 0] } },
          total_transaksi_input: {
            $sum: {
              $ifNull: [
                '$total_transaksi_input',
                { $subtract: [{ $ifNull: ['$debit_input', 0] }, { $ifNull: ['$credit_input', 0] }] },
              ],
            },
          },
          total_debit_validated: { $sum: { $ifNull: ['$debit_validated', 0] } },
          total_credit_validated: { $sum: { $ifNull: ['$credit_validated', 0] } },
          total_transaksi_validated: {
            $sum: {
              $ifNull: [
                '$total_transaksi_validated',
                { $subtract: [{ $ifNull: ['$debit_validated', 0] }, { $ifNull: ['$credit_validated', 0] }] },
              ],
            },
          },
        },
      },
    ]);
    const rows = await RekeningSaldoHarian.find(filter)
      .sort({ tanggal: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const data = rows.map((r: any) => {
      const debit_input = Number(r.debit_input || 0);
      const credit_input = Number(r.credit_input || 0);
      const debit_validated = Number(r.debit_validated || 0);
      const credit_validated = Number(r.credit_validated || 0);
      const total_transaksi_input = Number((r.total_transaksi_input ?? (debit_input - credit_input)) || 0);
      const total_transaksi_validated = Number((r.total_transaksi_validated ?? (debit_validated - credit_validated)) || 0);
      const gap_harian = total_transaksi_input - total_transaksi_validated;
      const gap_kumulatif = Number(r.saldo_akhir_input || 0) - Number(r.saldo_akhir_validated || 0);
      return {
        ...r,
        debit_input,
        credit_input,
        debit_validated,
        credit_validated,
        total_transaksi_input,
        total_transaksi_validated,
        gap_harian,
        gap_kumulatif,
      };
    });

    res.json({
      data,
      page: pageNum,
      total,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
      summary: summaryAgg[0]
        ? {
            total_debit_input: Number(summaryAgg[0].total_debit_input || 0),
            total_credit_input: Number(summaryAgg[0].total_credit_input || 0),
            total_net_input: Number(summaryAgg[0].total_transaksi_input || 0),
            total_debit_validated: Number(summaryAgg[0].total_debit_validated || 0),
            total_credit_validated: Number(summaryAgg[0].total_credit_validated || 0),
            total_net_validated: Number(summaryAgg[0].total_transaksi_validated || 0),
          }
        : {
            total_debit_input: 0,
            total_credit_input: 0,
            total_net_input: 0,
            total_debit_validated: 0,
            total_credit_validated: 0,
            total_net_validated: 0,
          },
    });
  } catch (error) {
    next(error);
  }
};

// Update validator notes (hanya superuser/corsec)
export const updateValidatorNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any; // diasumsikan sudah ada middleware auth, req.user terisi
    if (!user || (user.role !== 'superuser' && user.role !== 'corsec')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { id, validator_notes } = req.body;
    if (!id) return res.status(400).json({ message: 'ID is required' });
    const doc = await TtFinanceDetail.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi detail not found' });

    doc.validator_notes = validator_notes || '';
    doc.validator_notes_by = user?.username || user?.email || user?._id || '';
    doc.validator_notes_at = new Date();
    await doc.save();
    res.json({ success: true, message: 'Validator notes berhasil diperbarui', validator_notes_by: doc.validator_notes_by, validator_at: doc.validator_notes_at });
  } catch (error) {
    next(error);
  }
};
