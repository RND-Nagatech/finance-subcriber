import TtFinanceDetail from '../models/TtFinanceDetail';
import { calculateSignedDelta, hasValidRekeningKey } from './rekeningDailyBalanceService';

export interface BuildProjectionParams {
  kode_bank: string;
  no_rekening: string;
  start_date: string; // YYYY-MM-DD
  start_balance_input: number;
  start_balance_validated: number;
}

export interface DailyProjectionRow {
  tanggal: string;
  saldo_awal_input: number;
  total_transaksi_input: number;
  saldo_akhir_input: number;
  saldo_awal_validated: number;
  total_transaksi_validated: number;
  saldo_akhir_validated: number;
  count_transaksi_input: number;
  count_transaksi_validated: number;
  gap_harian: number;
  gap_kumulatif: number;
}

function toYmd(dateInput: Date | string): string {
  if (typeof dateInput === 'string') return String(dateInput).slice(0, 10);
  const yyyy = dateInput.getFullYear();
  const mm = String(dateInput.getMonth() + 1).padStart(2, '0');
  const dd = String(dateInput.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateRange(startDateYmd: string, endDateYmd: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startDateYmd}T00:00:00`);
  const end = new Date(`${endDateYmd}T00:00:00`);
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    out.push(toYmd(new Date(d)));
  }
  return out;
}

export async function buildDailyProjectionFromTransactions(params: BuildProjectionParams): Promise<{
  rows: DailyProjectionRow[];
  today: string;
}> {
  const kodeBank = String(params.kode_bank || '').trim();
  const noRekening = String(params.no_rekening || '').trim();
  const startDate = String(params.start_date || '').trim();
  const startBalanceInput = Number(params.start_balance_input || 0);
  const startBalanceValidated = Number(params.start_balance_validated || 0);

  if (!hasValidRekeningKey(kodeBank, noRekening)) {
    throw new Error('kode_bank/no_rekening tidak valid');
  }
  if (!isValidYmd(startDate)) {
    throw new Error('start_date harus format YYYY-MM-DD');
  }

  const today = toYmd(new Date());
  if (startDate > today) {
    throw new Error('start_date tidak boleh lebih besar dari hari ini');
  }

  const docs = await TtFinanceDetail.find({
    kode_bank: kodeBank,
    no_rekening: noRekening,
    status_deleted: { $ne: true },
    tanggal: { $gte: startDate, $lte: today },
  })
    .select('tanggal kategori nilai is_validated')
    .sort({ tanggal: 1, created_at: 1, _id: 1 })
    .lean();

  const dayMap = new Map<string, {
    totalInput: number;
    totalValidated: number;
    countInput: number;
    countValidated: number;
  }>();

  for (const doc of docs as any[]) {
    const tgl = String(doc.tanggal || '').slice(0, 10);
    if (!isValidYmd(tgl)) continue;
    const delta = calculateSignedDelta(String(doc.kategori || ''), Number(doc.nilai || 0));
    const cur = dayMap.get(tgl) || {
      totalInput: 0,
      totalValidated: 0,
      countInput: 0,
      countValidated: 0,
    };
    cur.totalInput += delta;
    cur.countInput += 1;
    if (doc.is_validated) {
      cur.totalValidated += delta;
      cur.countValidated += 1;
    }
    dayMap.set(tgl, cur);
  }

  const days = dateRange(startDate, today);
  const rows: DailyProjectionRow[] = [];
  let prevInput = startBalanceInput;
  let prevValidated = startBalanceValidated;

  for (const day of days) {
    const bucket = dayMap.get(day);
    const totalInput = Number(bucket?.totalInput || 0);
    const totalValidated = Number(bucket?.totalValidated || 0);
    const countInput = Number(bucket?.countInput || 0);
    const countValidated = Number(bucket?.countValidated || 0);
    const saldoAwalInput = prevInput;
    const saldoAkhirInput = saldoAwalInput + totalInput;
    const saldoAwalValidated = prevValidated;
    const saldoAkhirValidated = saldoAwalValidated + totalValidated;
    prevInput = saldoAkhirInput;
    prevValidated = saldoAkhirValidated;

    rows.push({
      tanggal: day,
      saldo_awal_input: saldoAwalInput,
      total_transaksi_input: totalInput,
      saldo_akhir_input: saldoAkhirInput,
      saldo_awal_validated: saldoAwalValidated,
      total_transaksi_validated: totalValidated,
      saldo_akhir_validated: saldoAkhirValidated,
      count_transaksi_input: countInput,
      count_transaksi_validated: countValidated,
      gap_harian: totalInput - totalValidated,
      gap_kumulatif: saldoAkhirInput - saldoAkhirValidated,
    });
  }

  return { rows, today };
}

