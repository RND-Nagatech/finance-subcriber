import TtFinanceDetail from '../models/TtFinanceDetail';
import { calculateSignedDelta, hasValidRekeningKey } from './rekeningDailyBalanceService';
import RekeningTransfer from '../models/RekeningTransfer';

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
  debit_input: number;
  credit_input: number;
  total_transaksi_input: number;
  saldo_akhir_input: number;
  saldo_awal_validated: number;
  debit_validated: number;
  credit_validated: number;
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
    debitInput: number;
    creditInput: number;
    debitValidated: number;
    creditValidated: number;
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
      debitInput: 0,
      creditInput: 0,
      debitValidated: 0,
      creditValidated: 0,
      totalInput: 0,
      totalValidated: 0,
      countInput: 0,
      countValidated: 0,
    };
    if (delta >= 0) cur.debitInput += delta;
    else cur.creditInput += Math.abs(delta);
    cur.totalInput += delta;
    cur.countInput += 1;
    if (doc.is_validated) {
      if (delta >= 0) cur.debitValidated += delta;
      else cur.creditValidated += Math.abs(delta);
      cur.totalValidated += delta;
      cur.countValidated += 1;
    }
    dayMap.set(tgl, cur);
  }

  const transferDocs = await RekeningTransfer.find({
    tanggal: { $gte: new Date(`${startDate}T00:00:00.000Z`), $lte: new Date(`${today}T23:59:59.999Z`) },
    $or: [
      { from_kode_bank: kodeBank, from_no_rekening: noRekening },
      { to_kode_bank: kodeBank, to_no_rekening: noRekening },
    ],
  })
    .select('from_kode_bank from_no_rekening to_kode_bank to_no_rekening nominal tanggal')
    .sort({ tanggal: 1, created_at: 1, _id: 1 })
    .lean();

  for (const tr of transferDocs as any[]) {
    const tgl = toYmd(tr.tanggal);
    if (!isValidYmd(tgl)) continue;
    const amount = Number(tr.nominal || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const isFrom = String(tr.from_kode_bank || '') === kodeBank && String(tr.from_no_rekening || '') === noRekening;
    const isTo = String(tr.to_kode_bank || '') === kodeBank && String(tr.to_no_rekening || '') === noRekening;
    if (!isFrom && !isTo) continue;

    const cur = dayMap.get(tgl) || {
      debitInput: 0,
      creditInput: 0,
      debitValidated: 0,
      creditValidated: 0,
      totalInput: 0,
      totalValidated: 0,
      countInput: 0,
      countValidated: 0,
    };

    if (isFrom) {
      cur.creditInput += amount;
      cur.totalInput -= amount;
      cur.creditValidated += amount;
      cur.totalValidated -= amount;
    } else if (isTo) {
      cur.debitInput += amount;
      cur.totalInput += amount;
      cur.debitValidated += amount;
      cur.totalValidated += amount;
    }
    cur.countInput += 1;
    cur.countValidated += 1;
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
    const debitInput = Number(bucket?.debitInput || 0);
    const creditInput = Number(bucket?.creditInput || 0);
    const debitValidated = Number(bucket?.debitValidated || 0);
    const creditValidated = Number(bucket?.creditValidated || 0);
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
      debit_input: debitInput,
      credit_input: creditInput,
      total_transaksi_input: totalInput,
      saldo_akhir_input: saldoAkhirInput,
      saldo_awal_validated: saldoAwalValidated,
      debit_validated: debitValidated,
      credit_validated: creditValidated,
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
