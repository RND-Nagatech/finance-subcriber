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
  validator_notes?: string;
  validator_notes_by?: string;
  validator_notes_at?: Date;
  validated_at?: Date;
  kode_perusahaan?: string;
  nama_perusahaan?: string;
  kode_bank?: string;
  no_rekening?: string;
  source_type?: 'REKENING' | 'ASSET';
  asset_id?: mongoose.Types.ObjectId | string;
  asset_code?: string;
  asset_name?: string;
  asset_qty?: number;
  asset_unit?: string;
  asset_unit_price_snapshot?: number;
  perjalanan_dinas_id?: mongoose.Types.ObjectId | string;
  is_special_transaction?: boolean;
  transaction_mode?: 'NORMAL' | 'SPECIAL' | 'FINANCE_ONLY';
}

const TtFinanceDetailSchema: Schema = new Schema({
  is_validated: { type: Boolean, default: false },
  validator_notes: { type: String },
  validator_notes_by: { type: String },
  validator_notes_at: { type: Date },
  validated_at: { type: Date },
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
  source_type: { type: String, enum: ['REKENING', 'ASSET'], default: 'REKENING', index: true },
  asset_id: { type: Schema.Types.ObjectId, ref: 'Asset', index: true },
  asset_code: { type: String },
  asset_name: { type: String },
  asset_qty: { type: Number, min: 0 },
  asset_unit: { type: String },
  asset_unit_price_snapshot: { type: Number, min: 0 },
  perjalanan_dinas_id: { type: Schema.Types.ObjectId, ref: 'PerjalananDinas', index: true },
  is_special_transaction: { type: Boolean, default: false, index: true },
  transaction_mode: {
    type: String,
    enum: ['NORMAL', 'SPECIAL', 'FINANCE_ONLY'],
    default: 'NORMAL',
    index: true,
  },
  attachments: { type: [{ path: { type: String, required: true } }], default: [] },
});

export default mongoose.model<ITtFinanceDetail>('tt_finance_detail', TtFinanceDetailSchema);
