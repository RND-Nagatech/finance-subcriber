import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Rekening from '../models/Rekening';
import RekeningSaldoHarian from '../models/RekeningSaldoHarian';
import { buildDailyProjectionFromTransactions } from '../services/rekeningDailyProjectionService';

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
