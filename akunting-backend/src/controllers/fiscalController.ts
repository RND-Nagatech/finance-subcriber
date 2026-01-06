import { Request, Response } from 'express';
import TTFinance from '../models/Transaksi';
import ThFinance from '../models/ThFinance';
import Transaksi from '../models/Transaksi';
import FiscalConfig from '../models/FiscalConfig';
import { fiscalMonthsForYear } from '../utils/fiscal';
import TtFinanceDaily from '../models/TtFinanceDaily';
import ThFinanceDaily from '../models/ThFinanceDaily';
// GET /fiscal/years
export const getFiscalYears = async (req: Request, res: Response) => {
  try {
    // Ambil tahun fiskal dari semua transaksi dan th_finance
    const tahunTransaksi = await Transaksi.distinct('tahun_fiskal');
    const tahunThFinance = await ThFinance.distinct('tahun_fiskal');
    const tahunList = Array.from(new Set([...tahunTransaksi, ...tahunThFinance]))
      .map(t => parseInt(t)).filter(t => !isNaN(t)).sort((a, b) => b - a);
    res.json({ success: true, years: tahunList });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// GET /fiscal/months?tahun=xxxx
export const getFiscalMonths = async (req: Request, res: Response) => {
  try {
    const tahun = Number(req.query.tahun) || new Date().getFullYear();
    const months = fiscalMonthsForYear(tahun);
    res.json({ success: true, months });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// POST /fiscal/close
export const closeFiscalYear = async (req: Request, res: Response) => {
  try {
    const { fiscalYear } = req.body;
    if (!fiscalYear) return res.status(400).json({ message: 'Fiscal year required' });

    // Ambil semua transaksi tahun berjalan
    const transaksi = await TTFinance.find({ tahun_fiskal: fiscalYear });
    if (!transaksi.length) return res.status(404).json({ message: 'Tidak ada transaksi tahun berjalan' });


    // Migrasi ke th_finance: gabung data bulanan dalam satu dokumen per akun/kategori/sub_kategori/tahun fiskal
    const migrated = [];
    for (const trx of transaksi) {
      const thFinance = new ThFinance({
        kategori: trx.kategori,
        sub_kategori: trx.sub_kategori,
        akun: trx.akun,
        data_bulanan: trx.data_bulanan,
        total_tahunan: trx.total_tahunan,
        input_by: trx.input_by,
        tahun_fiskal: trx.tahun_fiskal || fiscalYear,
        created_at: trx.created_at,
        updated_at: trx.updated_at,
      });
      await thFinance.save();
      migrated.push(thFinance);
    }

    // Migrasi tt_finance_daily ke th_finance_daily
    const dailyDocs = await TtFinanceDaily.find({ tahun_fiskal: fiscalYear });
    let migratedDaily = 0;
    for (const doc of dailyDocs) {
      const thDaily = new ThFinanceDaily({
        tanggal: doc.tanggal,
        bulan_fiskal: doc.bulan_fiskal,
        tahun_fiskal: doc.tahun_fiskal,
        kategori: doc.kategori,
        sub_kategori: doc.sub_kategori,
        akun: doc.akun,
        total_nilai: doc.total_nilai,
        created_at: doc.created_at,
      });
      await thDaily.save();
      migratedDaily++;
    }
    // Hapus data tahun berjalan dari tt_finance_daily
    await TtFinanceDaily.deleteMany({ tahun_fiskal: fiscalYear });

    // Hapus transaksi tahun berjalan dari tt_finance
    await TTFinance.deleteMany({ tahun_fiskal: fiscalYear });

    // Persist new active fiscal year (tahun berikutnya)
    const nextYear = Number(fiscalYear) + 1;
    await FiscalConfig.findOneAndUpdate(
      { key: 'fiscal' },
      { active_year: nextYear },
      { upsert: true, new: true }
    );

    res.json({ success: true, migratedCount: migrated.length, migratedDaily, nextActive: nextYear });
  } catch (error) {
    console.error('❌ Error in closeFiscalYear:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// GET /fiscal/active
export const getActiveFiscalYear = async (req: Request, res: Response) => {
  try {
    const cfg = await FiscalConfig.findOne({ key: 'fiscal' }).lean();
    if (cfg && cfg.active_year) {
      return res.json({ success: true, activeYear: cfg.active_year });
    }
    // Fallback: infer from existing data (max of distinct years)
    const tahunTransaksi = await Transaksi.distinct('tahun_fiskal');
    const tahunThFinance = await ThFinance.distinct('tahun_fiskal');
    const tahunList = Array.from(new Set([...tahunTransaksi, ...tahunThFinance]))
      .map(t => parseInt(t)).filter(t => !isNaN(t)).sort((a, b) => b - a);
    const inferred = tahunList.length ? Math.max(...tahunList) : new Date().getFullYear();
    res.json({ success: true, activeYear: inferred });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
