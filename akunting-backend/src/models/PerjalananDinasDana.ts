import mongoose, { Document, Schema } from 'mongoose';

export type PerjalananDanaJenis = 'INJECT' | 'RETURN';

export interface IPerjalananDinasDana extends Document {
  perjalanan_id: mongoose.Types.ObjectId;
  jenis: PerjalananDanaJenis;
  nominal: number;
  rekening_id: mongoose.Types.ObjectId;
  kode_bank: string;
  no_rekening: string;
  nama_rekening_snapshot: string;
  keterangan?: string;
  created_by: string;
  created_at: Date;
  voided: boolean;
  voided_by?: string;
  voided_at?: Date;
}

const PerjalananDinasDanaSchema = new Schema<IPerjalananDinasDana>(
  {
    perjalanan_id: { type: Schema.Types.ObjectId, ref: 'PerjalananDinas', required: true, index: true },
    jenis: { type: String, enum: ['INJECT', 'RETURN'], required: true, index: true },
    nominal: { type: Number, required: true, min: 0 },
    rekening_id: { type: Schema.Types.ObjectId, ref: 'Rekening', required: true },
    kode_bank: { type: String, required: true },
    no_rekening: { type: String, required: true },
    nama_rekening_snapshot: { type: String, required: true },
    keterangan: { type: String, default: '' },
    created_by: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    voided: { type: Boolean, default: false },
    voided_by: { type: String },
    voided_at: { type: Date },
  },
  { collection: 'tt_perjalanan_dinas_dana' }
);

PerjalananDinasDanaSchema.index({ perjalanan_id: 1, jenis: 1, created_at: -1 });

export default mongoose.model<IPerjalananDinasDana>('PerjalananDinasDana', PerjalananDinasDanaSchema);
