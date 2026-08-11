import mongoose, { Document, Schema } from 'mongoose';

export interface IDataBulananTh {
  bulan: string;
  nilai: number;
}

export interface IThFinance extends Document {
  kategori: string;
  sub_kategori: string;
  akun: string;
  data_bulanan: IDataBulananTh[];
  total_tahunan: number;
  input_by: string;
  created_at: Date;
  updated_at: Date;
}

const DataBulananThSchema: Schema = new Schema({
  bulan: { type: String, required: true },
  nilai: { type: Number, required: true },
});

const ThFinanceSchema: Schema = new Schema({
  kategori: { type: String, required: true },
  sub_kategori: { type: String, required: true },
  akun: { type: String, required: true },
  data_bulanan: { type: [DataBulananThSchema], default: [] },
  total_tahunan: { type: Number, default: 0 },
  input_by: { type: String, required: true },
  tahun_fiskal: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export default mongoose.model<IThFinance>('ThFinance', ThFinanceSchema, 'th_finance');
