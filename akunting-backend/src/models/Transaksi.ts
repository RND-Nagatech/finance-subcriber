


import mongoose, { Schema, Document } from 'mongoose';

export interface IDataBulanan {
  bulan: string;
  nilai: number;
}

export interface IAttachment {
  path: string;
}

export interface ITransaksi extends Document {
  kategori: string;
  sub_kategori: string;
  akun: string;
  data_bulanan: IDataBulanan[];
  total_tahunan: number;
  input_by: string;
  tahun_fiskal: string;
  attachments: IAttachment[];
  created_at: Date;
  updated_at: Date;
}

const DataBulananSchema: Schema = new Schema({
  bulan: { type: String, required: true },
  nilai: { type: Number, required: true },
});

const AttachmentSchema: Schema = new Schema({
  path: { type: String, required: true },
});

const TransaksiSchema: Schema = new Schema({
  kategori: { type: String, required: true },
  sub_kategori: { type: String, required: true },
  akun: { type: String, required: true },
  data_bulanan: { type: [DataBulananSchema], default: [] },
  total_tahunan: { type: Number, default: 0 },
  input_by: { type: String, required: true },
  tahun_fiskal: { type: String, required: true },
  attachments: { type: [AttachmentSchema], default: [] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export default mongoose.model<ITransaksi>('Transaksi', TransaksiSchema, 'tt_finance');
