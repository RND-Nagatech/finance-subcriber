import mongoose from 'mongoose';
import Rekening from '../models/Rekening';
import RiwayatSaldoRekening from '../models/RiwayatSaldoRekening';

export async function mutateRekeningForPerjalananLedger(params: {
  rekening_id: string;
  nominal: number;
  jenis: 'INJECT' | 'RETURN';
  tanggal: Date;
  keterangan: string;
  refId: mongoose.Types.ObjectId;
}) {
  const rekening = await Rekening.findById(params.rekening_id);
  if (!rekening) {
    throw new Error('Rekening tidak ditemukan');
  }

  const saldoAwal = rekening.saldo || 0;
  let saldoMasuk = 0;
  let saldoKeluar = 0;
  let saldoAkhir = saldoAwal;

  if (params.jenis === 'INJECT') {
    saldoKeluar = params.nominal;
    saldoAkhir -= params.nominal;
  } else {
    saldoMasuk = params.nominal;
    saldoAkhir += params.nominal;
  }

  if (saldoAkhir < 0) {
    throw new Error('Saldo rekening tidak mencukupi untuk inject');
  }

  await RiwayatSaldoRekening.create({
    kode_bank: rekening.kode_bank,
    no_rekening: rekening.no_rekening,
    saldo_awal: saldoAwal,
    saldo_masuk: saldoMasuk,
    saldo_keluar: saldoKeluar,
    saldo_akhir: saldoAkhir,
    tanggal: params.tanggal,
    keterangan: params.keterangan,
    ref_type: 'PERJALANAN_DANA',
    ref_id: params.refId,
  });

  rekening.saldo = saldoAkhir;
  await rekening.save();

  return rekening;
}
