import mongoose, { Schema } from 'mongoose';

const ThFinanceDailySchema = new Schema({
  tanggal: { type: String, required: true }, // YYYY-MM-DD
  bulan_fiskal: { type: String, required: true }, // e.g. NOV-25
  tahun_fiskal: { type: String, required: true },
  kategori: { type: String, required: true },
  sub_kategori: { type: String, required: true },
  akun: { type: String, required: true },
  total_nilai: { type: Number, required: true, default: 0 },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model('ThFinanceDaily', ThFinanceDailySchema, 'th_finance_daily');
