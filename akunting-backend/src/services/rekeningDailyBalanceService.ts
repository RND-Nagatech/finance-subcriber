import RekeningSaldoHarian from '../models/RekeningSaldoHarian';
import { ClientSession } from 'mongoose';

export interface DailyBalanceKey {
  kode_bank: string;
  no_rekening: string;
}

interface ApplyDeltaParams extends DailyBalanceKey {
  tanggal: string;
  delta: number;
  countDelta?: number;
  session?: ClientSession;
}

interface ApplyTransferParams {
  from_kode_bank: string;
  from_no_rekening: string;
  to_kode_bank: string;
  to_no_rekening: string;
  tanggal: string;
  nominal: number;
  session?: ClientSession;
}

function toYmd(dateInput: string | Date): string {
  if (typeof dateInput === 'string') return String(dateInput).slice(0, 10);
  const yyyy = dateInput.getFullYear();
  const mm = String(dateInput.getMonth() + 1).padStart(2, '0');
  const dd = String(dateInput.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function hasValidRekeningKey(kode_bank?: string, no_rekening?: string): boolean {
  const kode = String(kode_bank || '').trim();
  const norek = String(no_rekening || '').trim();
  return !!kode && !!norek && kode !== '-' && norek !== '-';
}

export function calculateSignedDelta(kategori: string, nilai: number): number {
  const amount = Number(nilai || 0);
  return String(kategori || '').toUpperCase() === 'PENDAPATAN' ? amount : -amount;
}

async function ensureDailyRow(params: DailyBalanceKey & { tanggal: string; session?: ClientSession }) {
  await RekeningSaldoHarian.updateOne(
    { kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal: params.tanggal },
    {
      $setOnInsert: {
        saldo_awal_input: 0,
        debit_input: 0,
        credit_input: 0,
        total_transaksi_input: 0,
        saldo_akhir_input: 0,
        saldo_awal_validated: 0,
        debit_validated: 0,
        credit_validated: 0,
        total_transaksi_validated: 0,
        saldo_akhir_validated: 0,
        count_transaksi_input: 0,
        count_transaksi_validated: 0,
      },
      $set: { updated_at: new Date() },
    },
    { upsert: true, session: params.session }
  );
}

export async function recalculateFromDate(params: DailyBalanceKey & { startDate: string; session?: ClientSession }) {
  const startDate = toYmd(params.startDate);
  const prev = await RekeningSaldoHarian.findOne({
    kode_bank: params.kode_bank,
    no_rekening: params.no_rekening,
    tanggal: { $lt: startDate },
  }).sort({ tanggal: -1 }).session(params.session || null);

  let prevInput = Number(prev?.saldo_akhir_input || 0);
  let prevValidated = Number(prev?.saldo_akhir_validated || 0);

  const rows = await RekeningSaldoHarian.find({
    kode_bank: params.kode_bank,
    no_rekening: params.no_rekening,
    tanggal: { $gte: startDate },
  }).sort({ tanggal: 1 }).session(params.session || null);

  if (!rows.length) return;

  const ops = rows.map((row) => {
    const totalInput = Number(row.total_transaksi_input || 0);
    const totalValidated = Number(row.total_transaksi_validated || 0);
    const saldoAwalInput = prevInput;
    const saldoAkhirInput = saldoAwalInput + totalInput;
    const saldoAwalValidated = prevValidated;
    const saldoAkhirValidated = saldoAwalValidated + totalValidated;
    prevInput = saldoAkhirInput;
    prevValidated = saldoAkhirValidated;

    return {
      updateOne: {
        filter: { _id: row._id },
        update: {
          $set: {
            saldo_awal_input: saldoAwalInput,
            saldo_akhir_input: saldoAkhirInput,
            saldo_awal_validated: saldoAwalValidated,
            saldo_akhir_validated: saldoAkhirValidated,
            updated_at: new Date(),
          },
        },
      },
    };
  });

  if (ops.length) {
    await RekeningSaldoHarian.bulkWrite(ops, params.session ? { session: params.session } : undefined);
  }
}

export async function applyInputDelta(params: ApplyDeltaParams) {
  const tanggal = toYmd(params.tanggal);
  const countDelta = Number(params.countDelta ?? 1);
  if (!countDelta) return;
  const baseSign = countDelta > 0 ? 1 : -1;
  const originalDelta = Number(params.delta || 0) * baseSign;
  const amount = Math.abs(Number(params.delta || 0));
  const debitInc = originalDelta >= 0 ? amount * baseSign : 0;
  const creditInc = originalDelta < 0 ? amount * baseSign : 0;
  const totalInc = Number(params.delta || 0);

  await ensureDailyRow({ kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal, session: params.session });
  await RekeningSaldoHarian.updateOne(
    { kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal },
    {
      $inc: {
        debit_input: debitInc,
        credit_input: creditInc,
        total_transaksi_input: totalInc,
        count_transaksi_input: countDelta,
      },
      $set: { updated_at: new Date() },
    },
    params.session ? { session: params.session } : undefined
  );
  await recalculateFromDate({ kode_bank: params.kode_bank, no_rekening: params.no_rekening, startDate: tanggal, session: params.session });
}

export async function applyValidatedDelta(params: ApplyDeltaParams) {
  const tanggal = toYmd(params.tanggal);
  const countDelta = Number(params.countDelta ?? 1);
  if (!countDelta) return;
  const baseSign = countDelta > 0 ? 1 : -1;
  const originalDelta = Number(params.delta || 0) * baseSign;
  const amount = Math.abs(Number(params.delta || 0));
  const debitInc = originalDelta >= 0 ? amount * baseSign : 0;
  const creditInc = originalDelta < 0 ? amount * baseSign : 0;
  const totalInc = Number(params.delta || 0);

  await ensureDailyRow({ kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal, session: params.session });
  await RekeningSaldoHarian.updateOne(
    { kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal },
    {
      $inc: {
        debit_validated: debitInc,
        credit_validated: creditInc,
        total_transaksi_validated: totalInc,
        count_transaksi_validated: countDelta,
      },
      $set: { updated_at: new Date() },
    },
    params.session ? { session: params.session } : undefined
  );
  await recalculateFromDate({ kode_bank: params.kode_bank, no_rekening: params.no_rekening, startDate: tanggal, session: params.session });
}

export async function applyTransferToDailyBalance(params: ApplyTransferParams) {
  const tanggal = toYmd(params.tanggal);
  const amount = Number(params.nominal || 0);
  if (!Number.isFinite(amount) || amount <= 0) return;

  // Sumber: credit (keluar) untuk input + validated
  await ensureDailyRow({
    kode_bank: params.from_kode_bank,
    no_rekening: params.from_no_rekening,
    tanggal,
    session: params.session,
  });
  await RekeningSaldoHarian.updateOne(
    { kode_bank: params.from_kode_bank, no_rekening: params.from_no_rekening, tanggal },
    {
      $inc: {
        credit_input: amount,
        total_transaksi_input: -amount,
        count_transaksi_input: 1,
        credit_validated: amount,
        total_transaksi_validated: -amount,
        count_transaksi_validated: 1,
      },
      $set: { updated_at: new Date() },
    },
    params.session ? { session: params.session } : undefined
  );
  await recalculateFromDate({
    kode_bank: params.from_kode_bank,
    no_rekening: params.from_no_rekening,
    startDate: tanggal,
    session: params.session,
  });

  // Tujuan: debit (masuk) untuk input + validated
  await ensureDailyRow({
    kode_bank: params.to_kode_bank,
    no_rekening: params.to_no_rekening,
    tanggal,
    session: params.session,
  });
  await RekeningSaldoHarian.updateOne(
    { kode_bank: params.to_kode_bank, no_rekening: params.to_no_rekening, tanggal },
    {
      $inc: {
        debit_input: amount,
        total_transaksi_input: amount,
        count_transaksi_input: 1,
        debit_validated: amount,
        total_transaksi_validated: amount,
        count_transaksi_validated: 1,
      },
      $set: { updated_at: new Date() },
    },
    params.session ? { session: params.session } : undefined
  );
  await recalculateFromDate({
    kode_bank: params.to_kode_bank,
    no_rekening: params.to_no_rekening,
    startDate: tanggal,
    session: params.session,
  });
}
