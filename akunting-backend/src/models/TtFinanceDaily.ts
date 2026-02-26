import mongoose, { Schema } from 'mongoose';

const TtFinanceDailySchema = new Schema({
  tanggal: { type: String, required: true }, // YYYY-MM-DD
  bulan_fiskal: { type: String, required: true }, // e.g. NOV-25
  tahun_fiskal: { type: String, required: true },
  kategori: { type: String, required: true },
  sub_kategori: { type: String, required: true },
  akun: { type: String, required: true },
  total_nilai: { type: Number, required: true, default: 0 },
  history: {
    type: [
      {
        nilai: { type: Number },
        nilai_awal: { type: Number, default: 0 },
        tanggal: { type: String }, // YYYY-MM-DD
        input_by: { type: String },
        input_at: { type: Date, default: Date.now },
        action: { type: String, enum: ['increment', 'decrement'], default: 'increment' }
      }
    ],
    default: []
  },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model('TtFinanceDaily', TtFinanceDailySchema, 'tt_finance_daily');
