import TtFinanceDaily from '../models/TtFinanceDaily';
import Transaksi from '../models/Transaksi';
import TtFinanceDetail from '../models/TtFinanceDetail';

export function deriveTahunFiskalFromBulan(bulan?: string): string | undefined {
  if (!bulan) return undefined;
  const match = bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
  if (!match) return undefined;
  const bulanStr = match[1].toUpperCase();
  let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2], 10) : parseInt(match[2], 10);
  const bulanMap: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  };
  const bulanAngka = bulanMap[bulanStr] || 1;
  return bulanAngka >= 12 ? String(tahunNum + 1) : String(tahunNum);
}

export async function updateTtFinanceDailyAggregation(
  tanggal: string,
  bulan: string,
  kategori: string,
  sub_kategori: string,
  akun: string,
  nilai: number,
  operation: 'increment' | 'decrement',
  inputBy?: string,
  inputAt?: Date
) {
  const tahunFiskal = deriveTahunFiskalFromBulan(bulan);
  if (!tahunFiskal) return;

  const [yyyy, mm] = tanggal.split('-');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthIdx = Math.max(0, Math.min(11, parseInt(mm || '1', 10) - 1));
  const bulanFiskal = `${monthNames[monthIdx]}-${yyyy.slice(2)}`;

  const filter = { tanggal, bulan_fiskal: bulanFiskal, tahun_fiskal: tahunFiskal, kategori, sub_kategori, akun };
  const existing = await TtFinanceDaily.findOne(filter);
  const nilaiAwal = (existing as any)?.total_nilai || 0;
  const signedNilai = operation === 'increment' ? nilai : -Math.abs(nilai);

  const updateObj: any = {
    $inc: { total_nilai: signedNilai },
    $setOnInsert: { created_at: new Date() },
  };
  if (inputBy) {
    updateObj.$push = {
      history: {
        nilai: signedNilai,
        nilai_awal: nilaiAwal,
        tanggal,
        input_by: inputBy,
        input_at: inputAt || new Date(),
        action: operation,
      },
    };
  }

  await TtFinanceDaily.findOneAndUpdate(filter, updateObj, { upsert: true, new: true });
  const updated = await TtFinanceDaily.findOne(filter);
  if (updated && ((updated as any).total_nilai || 0) < 0) {
    (updated as any).total_nilai = 0;
    await updated.save();
  }
}

export async function recalculateTransaksiAggregation(
  kategori: string,
  sub_kategori: string,
  akun: string,
  bulan: string,
  nilai: number,
  input_by: string,
  operation: 'increment' | 'decrement'
) {
  const tahunFiskal = deriveTahunFiskalFromBulan(bulan);
  if (!tahunFiskal) return;

  let doc = await Transaksi.findOne({ kategori, sub_kategori, akun, tahun_fiskal: tahunFiskal });

  if (!doc) {
    const signed = operation === 'increment' ? nilai : -Math.abs(nilai);
    doc = new Transaksi({
      kategori,
      sub_kategori,
      akun,
      data_bulanan: [{ bulan, nilai: Math.max(0, signed) }],
      total_tahunan: Math.max(0, signed),
      input_by,
      tahun_fiskal: tahunFiskal,
      created_at: new Date(),
      updated_at: new Date(),
      history: [{
        bulan,
        nilai: signed,
        nilai_awal: 0,
        input_by: input_by || '',
        input_at: new Date(),
        action: operation,
      }],
    } as any);
    await doc.save();
    return;
  }

  const idx = doc.data_bulanan.findIndex((d: any) => d.bulan === bulan);
  const nilaiAwal = idx >= 0 ? (doc.data_bulanan[idx] as any).nilai : 0;
  if (idx >= 0) {
    (doc.data_bulanan[idx] as any).nilai += operation === 'increment' ? nilai : -nilai;
    if ((doc.data_bulanan[idx] as any).nilai < 0) (doc.data_bulanan[idx] as any).nilai = 0;
  } else if (operation === 'increment') {
    doc.data_bulanan.push({ bulan, nilai } as any);
  }

  (doc as any).history = Array.isArray((doc as any).history) ? (doc as any).history : [];
  (doc as any).history.push({
    bulan,
    nilai: operation === 'increment' ? nilai : -Math.abs(nilai),
    nilai_awal: nilaiAwal,
    input_by: input_by || '',
    input_at: new Date(),
    action: operation,
  });

  doc.data_bulanan = (doc.data_bulanan as any).filter((d: any) => (d.nilai || 0) > 0);
  doc.total_tahunan = doc.data_bulanan.reduce((sum: number, d: any) => sum + (d.nilai || 0), 0);
  doc.updated_at = new Date();
  await doc.save();
}

export async function postPerjalananSummaryToTtFinance(params: {
  tanggal: string;
  bulan: string;
  tahun_fiskal?: string;
  kategori: string;
  sub_kategori: string;
  akun: string;
  nilai: number;
  created_by: string;
  keterangan: string;
}) {
  const tahunFiskal = params.tahun_fiskal || deriveTahunFiskalFromBulan(params.bulan);
  if (!tahunFiskal) throw new Error('tahun_fiskal tidak dapat ditentukan');

  const detail = new TtFinanceDetail({
    tanggal: params.tanggal,
    bulan: params.bulan,
    tahun_fiskal: tahunFiskal,
    kategori: params.kategori,
    sub_kategori: params.sub_kategori,
    akun: params.akun,
    nilai: params.nilai,
    keterangan: params.keterangan,
    created_by: params.created_by,
    created_at: new Date(),
    is_validated: true,
    kode_bank: '-',
    no_rekening: '-',
    attachments: [],
  } as any);

  await detail.save();
  await updateTtFinanceDailyAggregation(
    params.tanggal,
    params.bulan,
    params.kategori,
    params.sub_kategori,
    params.akun,
    params.nilai,
    'increment',
    params.created_by,
    new Date()
  );
  await recalculateTransaksiAggregation(
    params.kategori,
    params.sub_kategori,
    params.akun,
    params.bulan,
    params.nilai,
    params.created_by,
    'increment'
  );
  return detail;
}
