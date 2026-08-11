import mongoose, { Document, Schema } from 'mongoose';

interface IRekeningKoranDailyRow {
  tanggal: string; // YYYY-MM-DD
  debit: number;
  credit: number;
  tx_count: number;
}

export interface IRekeningKoranReconcile extends Document {
  kode_bank: string;
  no_rekening: string;
  acuan_bulan: string; // YYYY-MM
  bank_template: 'BCA' | string;
  parser_version: string;
  source_file_name: string;
  source_file_path: string;
  uploaded_by: string;
  uploaded_at: Date;
  daily_rows: IRekeningKoranDailyRow[];
  total_debit: number;
  total_credit: number;
  total_tx_count: number;
}

const DailyRowSchema = new Schema<IRekeningKoranDailyRow>(
  {
    tanggal: { type: String, required: true },
    debit: { type: Number, required: true, default: 0 },
    credit: { type: Number, required: true, default: 0 },
    tx_count: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const RekeningKoranReconcileSchema = new Schema<IRekeningKoranReconcile>(
  {
    kode_bank: { type: String, required: true, index: true },
    no_rekening: { type: String, required: true, index: true },
    acuan_bulan: { type: String, required: true, index: true },
    bank_template: { type: String, required: true, default: 'BCA' },
    parser_version: { type: String, required: true, default: 'bca-v1' },
    source_file_name: { type: String, required: true },
    source_file_path: { type: String, required: true },
    uploaded_by: { type: String, required: true, default: 'SYSTEM' },
    uploaded_at: { type: Date, required: true, default: Date.now },
    daily_rows: { type: [DailyRowSchema], default: [] },
    total_debit: { type: Number, required: true, default: 0 },
    total_credit: { type: Number, required: true, default: 0 },
    total_tx_count: { type: Number, required: true, default: 0 },
  },
  { collection: 'rekening_koran_reconcile' }
);

RekeningKoranReconcileSchema.index({ kode_bank: 1, no_rekening: 1, acuan_bulan: 1 }, { unique: true });
RekeningKoranReconcileSchema.index({ kode_bank: 1, no_rekening: 1, uploaded_at: -1 });

export default mongoose.model<IRekeningKoranReconcile>('RekeningKoranReconcile', RekeningKoranReconcileSchema);
