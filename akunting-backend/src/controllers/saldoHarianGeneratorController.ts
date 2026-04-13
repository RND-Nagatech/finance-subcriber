import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import Rekening from '../models/Rekening';
import RekeningSaldoHarian from '../models/RekeningSaldoHarian';
import { buildDailyProjectionFromTransactions } from '../services/rekeningDailyProjectionService';
import RekeningKoranReconcile from '../models/RekeningKoranReconcile';
import { parseBcaStatementPdf } from '../services/rekeningKoranBcaParserService';
import { parseMandiriStatementPdf } from '../services/rekeningKoranMandiriParserService';
import { buildDailyInputMovementMap } from '../services/rekeningDailyMovementService';

const RECONCILE_TOLERANCE = 100;

function resolveReconcileParserByBank(kodeBank: string) {
  const key = String(kodeBank || '').trim().toUpperCase();
  if (key.includes('BCA')) {
    return {
      bankTemplate: 'BCA',
      parserVersion: 'bca-v1',
      parse: parseBcaStatementPdf,
    };
  }
  if (key.includes('MANDIRI') || key.includes('BMRI')) {
    return {
      bankTemplate: 'MANDIRI',
      parserVersion: 'mandiri-v1',
      parse: parseMandiriStatementPdf,
    };
  }
  return null;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Terjadi kesalahan';
}

function isSuperuser(req: Request): boolean {
  const user = (req as any).user;
  return !!user && String(user.role || '') === 'superuser';
}

function validatePayload(body: any) {
  const kode_bank = String(body?.kode_bank || '').trim();
  const no_rekening = String(body?.no_rekening || '').trim();
  const start_date = String(body?.start_date || '').trim();
  const start_balance_input = Number(body?.start_balance_input);
  const start_balance_validated = Number(body?.start_balance_validated);

  if (!kode_bank || !no_rekening || !start_date) {
    throw new Error('kode_bank, no_rekening, dan start_date wajib diisi');
  }
  if (Number.isNaN(start_balance_input) || Number.isNaN(start_balance_validated)) {
    throw new Error('start_balance_input dan start_balance_validated harus number');
  }

  return {
    kode_bank,
    no_rekening,
    start_date,
    start_balance_input,
    start_balance_validated,
  };
}

function validateReconcileRangePayload(query: any) {
  const kode_bank = String(query?.kode_bank || '').trim();
  const no_rekening = String(query?.no_rekening || '').trim();
  const start_date = String(query?.start_date || '').trim();
  const end_date = String(query?.end_date || '').trim();
  const basis = String(query?.basis || 'input').trim().toLowerCase();

  if (!kode_bank || !no_rekening || !start_date || !end_date) {
    throw new Error('kode_bank, no_rekening, start_date, end_date wajib diisi');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    throw new Error('start_date dan end_date harus format YYYY-MM-DD');
  }
  if (start_date > end_date) {
    throw new Error('start_date tidak boleh lebih besar dari end_date');
  }
  if (basis !== 'input') {
    throw new Error('basis yang didukung saat ini hanya input');
  }

  return { kode_bank, no_rekening, start_date, end_date, basis };
}

function getMonthList(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    out.push(`${y}-${m}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function toMonthStartEnd(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
  const d = new Date(y, m, 0);
  const end = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start, end };
}

export const previewSaldoHarianRekening = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isSuperuser(req)) return res.status(403).json({ message: 'Unauthorized' });
    const payload = validatePayload(req.body || {});

    const rekening = await Rekening.findOne({
      kode_bank: payload.kode_bank,
      no_rekening: payload.no_rekening,
    }).lean();
    if (!rekening) {
      return res.status(404).json({ message: 'Rekening tidak ditemukan' });
    }

    const projection = await buildDailyProjectionFromTransactions(payload);
    const rows = projection.rows;
    const first = rows[0] || null;
    const last = rows[rows.length - 1] || null;

    return res.json({
      rekening: {
        kode_bank: payload.kode_bank,
        no_rekening: payload.no_rekening,
        nama_rekening: (rekening as any).nama_rekening || '',
      },
      start_date: payload.start_date,
      end_date: projection.today,
      affected_days: rows.length,
      summary: {
        first_day: first,
        last_day: last,
        total_debit_input: rows.reduce((s, r) => s + Number((r as any).debit_input || 0), 0),
        total_credit_input: rows.reduce((s, r) => s + Number((r as any).credit_input || 0), 0),
        total_input: rows.reduce((s, r) => s + Number(r.total_transaksi_input || 0), 0),
        total_debit_validated: rows.reduce((s, r) => s + Number((r as any).debit_validated || 0), 0),
        total_credit_validated: rows.reduce((s, r) => s + Number((r as any).credit_validated || 0), 0),
        total_validated: rows.reduce((s, r) => s + Number(r.total_transaksi_validated || 0), 0),
        final_gap: last ? Number(last.gap_kumulatif || 0) : 0,
      },
      rows,
    });
  } catch (error) {
    const msg = getErrorMessage(error);
    if (msg.includes('wajib') || msg.includes('format') || msg.includes('number') || msg.includes('tidak boleh')) {
      return res.status(400).json({ message: msg });
    }
    next(error);
  }
};

export const commitSaldoHarianRekening = async (req: Request, res: Response, next: NextFunction) => {
  const session = await mongoose.startSession();
  try {
    if (!isSuperuser(req)) return res.status(403).json({ message: 'Unauthorized' });
    const payload = validatePayload(req.body || {});
    if (req.body?.confirm !== true) {
      return res.status(400).json({ message: 'confirm harus true untuk commit' });
    }

    const rekening = await Rekening.findOne({
      kode_bank: payload.kode_bank,
      no_rekening: payload.no_rekening,
    }).lean();
    if (!rekening) {
      return res.status(404).json({ message: 'Rekening tidak ditemukan' });
    }

    const projection = await buildDailyProjectionFromTransactions(payload);
    const rows = projection.rows;
    const today = projection.today;

    await session.withTransaction(async () => {
      await RekeningSaldoHarian.deleteMany({
        kode_bank: payload.kode_bank,
        no_rekening: payload.no_rekening,
        tanggal: { $gte: payload.start_date, $lte: today },
      }).session(session);

      if (rows.length > 0) {
        await RekeningSaldoHarian.insertMany(
          rows.map((r) => ({
            kode_bank: payload.kode_bank,
            no_rekening: payload.no_rekening,
            tanggal: r.tanggal,
            saldo_awal_input: r.saldo_awal_input,
            debit_input: (r as any).debit_input || 0,
            credit_input: (r as any).credit_input || 0,
            total_transaksi_input: r.total_transaksi_input,
            saldo_akhir_input: r.saldo_akhir_input,
            saldo_awal_validated: r.saldo_awal_validated,
            debit_validated: (r as any).debit_validated || 0,
            credit_validated: (r as any).credit_validated || 0,
            total_transaksi_validated: r.total_transaksi_validated,
            saldo_akhir_validated: r.saldo_akhir_validated,
            count_transaksi_input: r.count_transaksi_input,
            count_transaksi_validated: r.count_transaksi_validated,
            updated_at: new Date(),
          })),
          { session }
        );
      }
    });

    const last = rows[rows.length - 1] || null;
    return res.json({
      success: true,
      message: 'Saldo harian berhasil disimpan',
      rekening: {
        kode_bank: payload.kode_bank,
        no_rekening: payload.no_rekening,
        nama_rekening: (rekening as any).nama_rekening || '',
      },
      start_date: payload.start_date,
      end_date: today,
      affected_days: rows.length,
      summary: {
        total_debit_input: rows.reduce((s, r) => s + Number((r as any).debit_input || 0), 0),
        total_credit_input: rows.reduce((s, r) => s + Number((r as any).credit_input || 0), 0),
        total_input: rows.reduce((s, r) => s + Number(r.total_transaksi_input || 0), 0),
        total_debit_validated: rows.reduce((s, r) => s + Number((r as any).debit_validated || 0), 0),
        total_credit_validated: rows.reduce((s, r) => s + Number((r as any).credit_validated || 0), 0),
        total_validated: rows.reduce((s, r) => s + Number(r.total_transaksi_validated || 0), 0),
        final_saldo_input: last ? Number(last.saldo_akhir_input || 0) : payload.start_balance_input,
        final_saldo_validated: last ? Number(last.saldo_akhir_validated || 0) : payload.start_balance_validated,
        final_gap: last ? Number(last.gap_kumulatif || 0) : (payload.start_balance_input - payload.start_balance_validated),
      },
    });
  } catch (error) {
    const msg = getErrorMessage(error);
    if (msg.includes('wajib') || msg.includes('format') || msg.includes('number') || msg.includes('tidak boleh') || msg.includes('confirm')) {
      return res.status(400).json({ message: msg });
    }
    next(error);
  } finally {
    session.endSession();
  }
};

export const uploadRekeningKoranReconcile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isSuperuser(req)) return res.status(403).json({ message: 'Unauthorized' });
    const file = (req as any).file as Express.Multer.File | undefined;
    const kode_bank = String(req.body?.kode_bank || '').trim();
    const no_rekening = String(req.body?.no_rekening || '').trim();
    const acuan_bulan = String(req.body?.acuan_bulan || '').trim();
    const pdf_password = String(req.body?.pdf_password || '').trim();

    if (!file) return res.status(400).json({ message: 'File PDF wajib diupload' });
    if (!kode_bank || !no_rekening || !acuan_bulan) {
      return res.status(400).json({ message: 'kode_bank, no_rekening, dan acuan_bulan wajib diisi' });
    }
    if (!/^\d{4}-\d{2}$/.test(acuan_bulan)) {
      return res.status(400).json({ message: 'acuan_bulan harus format YYYY-MM' });
    }

    const rekening = await Rekening.findOne({ kode_bank, no_rekening }).lean();
    if (!rekening) return res.status(404).json({ message: 'Rekening tidak ditemukan' });

    const parser = resolveReconcileParserByBank(kode_bank);
    if (!parser) {
      return res.status(400).json({ message: `Bank ${kode_bank} belum didukung untuk parser rekonsiliasi PDF.` });
    }

    const fileBuffer = file.buffer && file.buffer.length > 0
      ? file.buffer
      : fs.readFileSync(file.path);
    const parsed = await parser.parse(fileBuffer, acuan_bulan, pdf_password || undefined);
    const total_debit = parsed.groupedDaily.reduce((s, r) => s + Number(r.debit || 0), 0);
    const total_credit = parsed.groupedDaily.reduce((s, r) => s + Number(r.credit || 0), 0);
    const total_tx_count = parsed.groupedDaily.reduce((s, r) => s + Number(r.tx_count || 0), 0);
    const actor = String((req as any)?.user?.username || (req as any)?.user?.name || (req as any)?.user?.email || 'SYSTEM');

    await RekeningKoranReconcile.findOneAndUpdate(
      { kode_bank, no_rekening, acuan_bulan },
      {
        $set: {
          source_file_name: file.originalname || file.filename,
          source_file_path: file.path,
          uploaded_by: actor,
          uploaded_at: new Date(),
          bank_template: parser.bankTemplate,
          parser_version: parser.parserVersion,
          daily_rows: parsed.groupedDaily,
          total_debit,
          total_credit,
          total_tx_count,
        },
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      message: 'Rekening koran berhasil diupload dan diproses',
      rekening: { kode_bank, no_rekening },
      acuan_bulan,
      summary: {
        total_days: parsed.groupedDaily.length,
        total_tx_count,
        total_debit,
        total_credit,
      },
    });
  } catch (error) {
    const msg = getErrorMessage(error);
    if (
      msg.includes('wajib') ||
      msg.includes('format') ||
      msg.includes('Password') ||
      msg.includes('terenkripsi') ||
      msg.includes('tidak dikenali') ||
      msg.includes('Tidak ada transaksi') ||
      msg.includes('Gagal membaca PDF')
    ) {
      return res.status(400).json({ message: msg });
    }
    next(error);
  }
};

export const listReconcileMonths = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isSuperuser(req)) return res.status(403).json({ message: 'Unauthorized' });
    const kode_bank = String(req.query?.kode_bank || '').trim();
    const no_rekening = String(req.query?.no_rekening || '').trim();
    if (!kode_bank || !no_rekening) {
      return res.status(400).json({ message: 'kode_bank dan no_rekening wajib diisi' });
    }

    const docs = await RekeningKoranReconcile.find({ kode_bank, no_rekening })
      .select('acuan_bulan uploaded_at uploaded_by total_tx_count total_debit total_credit')
      .sort({ acuan_bulan: 1 })
      .lean();

    return res.json({
      success: true,
      data: docs.map((d: any) => ({
        acuan_bulan: d.acuan_bulan,
        uploaded_at: d.uploaded_at,
        uploaded_by: d.uploaded_by,
        total_tx_count: d.total_tx_count || 0,
        total_debit: d.total_debit || 0,
        total_credit: d.total_credit || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getReconcileComparison = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isSuperuser(req)) return res.status(403).json({ message: 'Unauthorized' });
    const payload = validateReconcileRangePayload(req.query || {});
    const neededMonths = getMonthList(payload.start_date, payload.end_date);

    const uploads = await RekeningKoranReconcile.find({
      kode_bank: payload.kode_bank,
      no_rekening: payload.no_rekening,
      acuan_bulan: { $in: neededMonths },
    }).lean();

    const coveredMonths = new Set<string>(uploads.map((u: any) => String(u.acuan_bulan)));
    const pdfDailyMap = new Map<string, { debit: number; credit: number; tx_count: number }>();
    for (const up of uploads as any[]) {
      for (const row of (up.daily_rows || [])) {
        pdfDailyMap.set(String(row.tanggal), {
          debit: Number(row.debit || 0),
          credit: Number(row.credit || 0),
          tx_count: Number(row.tx_count || 0),
        });
      }
    }

    const inputMovementMap = await buildDailyInputMovementMap({
      kode_bank: payload.kode_bank,
      no_rekening: payload.no_rekening,
      start_date: payload.start_date,
      end_date: payload.end_date,
    });

    const statuses: Array<{
      tanggal: string;
      status: 'matched' | 'unmatched' | 'not_covered';
      input_debit: number;
      input_credit: number;
      pdf_debit: number;
      pdf_credit: number;
      diff_debit: number;
      diff_credit: number;
      tolerance: number;
    }> = [];

    const start = new Date(`${payload.start_date}T00:00:00`);
    const end = new Date(`${payload.end_date}T00:00:00`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const tanggal = `${y}-${m}-${day}`;
      const month = `${y}-${m}`;

      const input = inputMovementMap.get(tanggal);
      const input_debit = Number(input?.debitInput || 0);
      const input_credit = Number(input?.creditInput || 0);
      const pdf = pdfDailyMap.get(tanggal);

      if (!coveredMonths.has(month)) {
        statuses.push({
          tanggal,
          status: 'not_covered',
          input_debit,
          input_credit,
          pdf_debit: 0,
          pdf_credit: 0,
          diff_debit: 0,
          diff_credit: 0,
          tolerance: RECONCILE_TOLERANCE,
        });
        continue;
      }

      const pdf_debit = Number(pdf?.debit || 0);
      const pdf_credit = Number(pdf?.credit || 0);
      // Mapping rekonsiliasi rekening koran BCA:
      // - Mutasi DB di rekening koran diperlakukan sebagai CREDIT pada tabel internal
      // - Mutasi CR di rekening koran diperlakukan sebagai DEBIT pada tabel internal
      const diff_debit = Math.abs(input_credit - pdf_debit);
      const diff_credit = Math.abs(input_debit - pdf_credit);
      // Jika bulan sudah ter-cover upload PDF namun tanggal tidak muncul di PDF,
      // anggap mutasi tanggal tersebut 0/0 agar bisa tetap matched terhadap tabel 0/0.
      const status = diff_debit <= RECONCILE_TOLERANCE && diff_credit <= RECONCILE_TOLERANCE ? 'matched' : 'unmatched';

      statuses.push({
        tanggal,
        status,
        input_debit,
        input_credit,
        pdf_debit,
        pdf_credit,
        diff_debit,
        diff_credit,
        tolerance: RECONCILE_TOLERANCE,
      });
    }

    return res.json({
      success: true,
      rekening: { kode_bank: payload.kode_bank, no_rekening: payload.no_rekening },
      range: { start_date: payload.start_date, end_date: payload.end_date },
      basis: payload.basis,
      tolerance: RECONCILE_TOLERANCE,
      uploaded_months: neededMonths.filter((m) => coveredMonths.has(m)),
      statuses,
    });
  } catch (error) {
    const msg = getErrorMessage(error);
    if (msg.includes('wajib') || msg.includes('format') || msg.includes('basis') || msg.includes('tidak boleh')) {
      return res.status(400).json({ message: msg });
    }
    next(error);
  }
};
