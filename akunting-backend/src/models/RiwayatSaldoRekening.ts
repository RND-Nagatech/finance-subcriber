import mongoose, { Document, Schema } from 'mongoose';

export interface IRiwayatSaldoRekening extends Document {
  kode_bank: string;
  no_rekening: string;
  saldo_awal: number;
  saldo_masuk: number;
  saldo_keluar: number;
  saldo_akhir: number;
  transaksi_id?: mongoose.Types.ObjectId; // legacy reference ke TtFinanceDetail
  ref_type?: 'TT_FINANCE_DETAIL' | 'PERJALANAN_DANA' | 'TRANSFER_REKENING';
  ref_id?: mongoose.Types.ObjectId;
  tanggal: Date;
  keterangan: string;
  created_at: Date;
}

const RiwayatSaldoRekeningSchema: Schema = new Schema({
  kode_bank: { type: String, required: true },
  no_rekening: { type: String, required: true },
  saldo_awal: { type: Number, required: true, default: 0 },
  saldo_masuk: { type: Number, required: true, default: 0 },
  saldo_keluar: { type: Number, required: true, default: 0 },
  saldo_akhir: { type: Number, required: true, default: 0 },
  transaksi_id: { type: Schema.Types.ObjectId, ref: 'TtFinanceDetail', required: false },
  ref_type: { type: String, enum: ['TT_FINANCE_DETAIL', 'PERJALANAN_DANA', 'TRANSFER_REKENING'], required: false },
  ref_id: { type: Schema.Types.ObjectId, required: false },
  tanggal: { type: Date, required: true },
  keterangan: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

// Index untuk performa query
RiwayatSaldoRekeningSchema.index({ kode_bank: 1, no_rekening: 1, tanggal: -1 });
RiwayatSaldoRekeningSchema.index({ transaksi_id: 1 });
RiwayatSaldoRekeningSchema.index({ ref_type: 1, ref_id: 1 });

export default mongoose.model<IRiwayatSaldoRekening>('RiwayatSaldoRekening', RiwayatSaldoRekeningSchema);
