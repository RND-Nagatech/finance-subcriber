import mongoose, { Schema, Document } from 'mongoose';

export interface IAttachment {
  path: string;
}

export interface ITtFinanceDetail extends Document {
  tanggal: string;
  bulan: string;
  tahun_fiskal?: string;
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
  status_deleted?: boolean;
  attachments?: IAttachment[];
  is_validated?: boolean;
}

const TtFinanceDetailSchema: Schema = new Schema({
  is_validated: { type: Boolean, default: false },
  tanggal: { type: String, required: true },
  bulan: { type: String, required: true },
  tahun_fiskal: { type: String },
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
  kode_perusahaan: { type: String },
  nama_perusahaan: { type: String },
  kode_bank: { type: String },
  no_rekening: { type: String },
  attachments: { type: [{ path: { type: String, required: true } }], default: [] },
});

export default mongoose.model<ITtFinanceDetail>('tt_finance_detail', TtFinanceDetailSchema);
