import mongoose, { Document, Schema } from 'mongoose';

export interface IKaryawan extends Document {
  kode_karyawan: string;
  nama_karyawan: string;
  jabatan: string | null;
  divisi: string | null;
  no_hp: string | null;
  email: string | null;
  status_aktv: boolean;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const KaryawanSchema: Schema = new Schema({
  kode_karyawan: { type: String, required: true, trim: true, uppercase: true },
  nama_karyawan: { type: String, required: true, trim: true },
  jabatan: { type: String, required: false, default: null, trim: true },
  divisi: { type: String, required: false, default: null, trim: true },
  no_hp: { type: String, required: false, default: null, trim: true },
  email: { type: String, required: false, default: null, trim: true, lowercase: true },
  status_aktv: { type: Boolean, default: true },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
});

KaryawanSchema.index(
  { kode_karyawan: 1 },
  { unique: true, partialFilterExpression: { delete_date: null } }
);
KaryawanSchema.index({ nama_karyawan: 1 });

export default mongoose.model<IKaryawan>('Karyawan', KaryawanSchema, 'tm_karyawan');
