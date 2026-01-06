import mongoose, { Schema, Document } from 'mongoose';

export interface ITtFinanceDetail extends Document {
  tanggal: string;
  bulan: string;
  kategori: string;
  sub_kategori: string;
  akun: string;
  nilai: number;
  keterangan?: string;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at?: Date;
  deleted_by?: string;
  deleted_at?: Date;
}

const TtFinanceDetailSchema: Schema = new Schema({
  tanggal: { type: String, required: true },
  bulan: { type: String, required: true },
  kategori: { type: String, required: true },
  sub_kategori: { type: String, required: true },
  akun: { type: String, required: true },
  nilai: { type: Number, required: true },
  keterangan: { type: String },
  created_by: { type: String, required: true },
  created_at: { type: Date, required: true, default: Date.now },
  updated_by: { type: String },
  updated_at: { type: Date },
  deleted_by: { type: String },
  deleted_at: { type: Date },
  status_deleted: { type: Boolean, default: false },
});

export default mongoose.model<ITtFinanceDetail>('tt_finance_detail', TtFinanceDetailSchema);
