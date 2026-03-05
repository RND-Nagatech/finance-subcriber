import mongoose, { Document, Schema } from 'mongoose';

export interface IRekeningSaldoHarian extends Document {
  kode_bank: string;
  no_rekening: string;
  tanggal: string; // YYYY-MM-DD
  saldo_awal_input: number;
  total_transaksi_input: number;
  saldo_akhir_input: number;
  saldo_awal_validated: number;
  total_transaksi_validated: number;
  saldo_akhir_validated: number;
  count_transaksi_input: number;
  count_transaksi_validated: number;
  updated_at: Date;
}

const RekeningSaldoHarianSchema = new Schema<IRekeningSaldoHarian>(
  {
    kode_bank: { type: String, required: true, index: true },
    no_rekening: { type: String, required: true, index: true },
    tanggal: { type: String, required: true, index: true },
    saldo_awal_input: { type: Number, required: true, default: 0 },
    total_transaksi_input: { type: Number, required: true, default: 0 },
    saldo_akhir_input: { type: Number, required: true, default: 0 },
    saldo_awal_validated: { type: Number, required: true, default: 0 },
    total_transaksi_validated: { type: Number, required: true, default: 0 },
    saldo_akhir_validated: { type: Number, required: true, default: 0 },
    count_transaksi_input: { type: Number, required: true, default: 0 },
    count_transaksi_validated: { type: Number, required: true, default: 0 },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: 'rekening_saldo_harian' }
);

RekeningSaldoHarianSchema.index({ kode_bank: 1, no_rekening: 1, tanggal: 1 }, { unique: true });
RekeningSaldoHarianSchema.index({ kode_bank: 1, no_rekening: 1, tanggal: -1 });

export default mongoose.model<IRekeningSaldoHarian>('RekeningSaldoHarian', RekeningSaldoHarianSchema);

