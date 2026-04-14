import TtFinanceDetail from '../models/TtFinanceDetail';
import RekeningTransfer from '../models/RekeningTransfer';
import { calculateSignedDelta, hasValidRekeningKey } from './rekeningDailyBalanceService';

export interface DailyMovementRow {
  tanggal: string;
  debit_input: number;
  credit_input: number;
  total_transaksi_input: number;
  count_transaksi_input: number;
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

export async function buildDailyInputMovementMap(params: {
  kode_bank: string;
  no_rekening: string;
  start_date: string;
  end_date: string;
}) {
  const kodeBank = String(params.kode_bank || '').trim();
  const noRekening = String(params.no_rekening || '').trim();
  const startDate = String(params.start_date || '').trim();
  const endDate = String(params.end_date || '').trim();

  if (!hasValidRekeningKey(kodeBank, noRekening)) {
    throw new Error('kode_bank/no_rekening tidak valid');
  }
  if (!isValidYmd(startDate) || !isValidYmd(endDate)) {
    throw new Error('start_date/end_date harus format YYYY-MM-DD');
  }
  if (startDate > endDate) {
    throw new Error('start_date tidak boleh lebih besar dari end_date');
  }

  const dayMap = new Map<string, {
    debitInput: number;
    creditInput: number;
    totalInput: number;
    countInput: number;
  }>();

  const docs = await TtFinanceDetail.find({
    kode_bank: kodeBank,
    no_rekening: noRekening,
    status_deleted: { $ne: true },
    transaction_mode: { $ne: 'FINANCE_ONLY' },
    tanggal: { $gte: startDate, $lte: endDate },
  })
    .select('tanggal kategori nilai')
    .sort({ tanggal: 1, created_at: 1, _id: 1 })
    .lean();

  for (const doc of docs as any[]) {
    const tgl = String(doc.tanggal || '').slice(0, 10);
    if (!isValidYmd(tgl)) continue;
    const delta = calculateSignedDelta(String(doc.kategori || ''), Number(doc.nilai || 0));
    const cur = dayMap.get(tgl) || {
      debitInput: 0,
      creditInput: 0,
      totalInput: 0,
      countInput: 0,
    };

    if (delta >= 0) cur.debitInput += delta;
    else cur.creditInput += Math.abs(delta);
    cur.totalInput += delta;
    cur.countInput += 1;
    dayMap.set(tgl, cur);
  }

  const transferDocs = await RekeningTransfer.find({
    tanggal: { $gte: new Date(`${startDate}T00:00:00.000Z`), $lte: new Date(`${endDate}T23:59:59.999Z`) },
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
      totalInput: 0,
      countInput: 0,
    };

    if (isFrom) {
      cur.creditInput += amount;
      cur.totalInput -= amount;
    } else {
      cur.debitInput += amount;
      cur.totalInput += amount;
    }

    cur.countInput += 1;
    dayMap.set(tgl, cur);
  }

  return dayMap;
}

export function convertMovementMapToRows(dayMap: Map<string, {
  debitInput: number;
  creditInput: number;
  totalInput: number;
  countInput: number;
}>): DailyMovementRow[] {
  return Array.from(dayMap.entries())
    .map(([tanggal, d]) => ({
      tanggal,
      debit_input: Number(d.debitInput || 0),
      credit_input: Number(d.creditInput || 0),
      total_transaksi_input: Number(d.totalInput || 0),
      count_transaksi_input: Number(d.countInput || 0),
    }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}
