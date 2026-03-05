import RekeningSaldoHarian from '../models/RekeningSaldoHarian';

export interface DailyBalanceKey {
  kode_bank: string;
  no_rekening: string;
}

interface ApplyDeltaParams extends DailyBalanceKey {
  tanggal: string;
  delta: number;
  countDelta?: number;
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

async function ensureDailyRow(params: DailyBalanceKey & { tanggal: string }) {
  await RekeningSaldoHarian.updateOne(
    { kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal: params.tanggal },
    {
      $setOnInsert: {
        saldo_awal_input: 0,
        total_transaksi_input: 0,
        saldo_akhir_input: 0,
        saldo_awal_validated: 0,
        total_transaksi_validated: 0,
        saldo_akhir_validated: 0,
        count_transaksi_input: 0,
        count_transaksi_validated: 0,
      },
      $set: { updated_at: new Date() },
    },
    { upsert: true }
  );
}

export async function recalculateFromDate(params: DailyBalanceKey & { startDate: string }) {
  const startDate = toYmd(params.startDate);
  const prev = await RekeningSaldoHarian.findOne({
    kode_bank: params.kode_bank,
    no_rekening: params.no_rekening,
    tanggal: { $lt: startDate },
  }).sort({ tanggal: -1 });

  let prevInput = Number(prev?.saldo_akhir_input || 0);
  let prevValidated = Number(prev?.saldo_akhir_validated || 0);

  const rows = await RekeningSaldoHarian.find({
    kode_bank: params.kode_bank,
    no_rekening: params.no_rekening,
    tanggal: { $gte: startDate },
  }).sort({ tanggal: 1 });

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
    await RekeningSaldoHarian.bulkWrite(ops);
  }
}

export async function applyInputDelta(params: ApplyDeltaParams) {
  const tanggal = toYmd(params.tanggal);
  const countDelta = Number(params.countDelta ?? 1);
  await ensureDailyRow({ kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal });
  await RekeningSaldoHarian.updateOne(
    { kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal },
    {
      $inc: {
        total_transaksi_input: Number(params.delta || 0),
        count_transaksi_input: countDelta,
      },
      $set: { updated_at: new Date() },
    }
  );
  await recalculateFromDate({ kode_bank: params.kode_bank, no_rekening: params.no_rekening, startDate: tanggal });
}

export async function applyValidatedDelta(params: ApplyDeltaParams) {
  const tanggal = toYmd(params.tanggal);
  const countDelta = Number(params.countDelta ?? 1);
  await ensureDailyRow({ kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal });
  await RekeningSaldoHarian.updateOne(
    { kode_bank: params.kode_bank, no_rekening: params.no_rekening, tanggal },
    {
      $inc: {
        total_transaksi_validated: Number(params.delta || 0),
        count_transaksi_validated: countDelta,
      },
      $set: { updated_at: new Date() },
    }
  );
  await recalculateFromDate({ kode_bank: params.kode_bank, no_rekening: params.no_rekening, startDate: tanggal });
}

