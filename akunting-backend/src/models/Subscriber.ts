import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriber extends Document {
  kode: string;
  no_ok: string | null;
  nomor_telepon: string | null;
  sales: string | null;
  nama_owner: string | null;
  no_hp_owner: string | null;
  gender_owner: 'LAKI-LAKI' | 'PEREMPUAN' | null;
  nama_pic: string | null;
  no_hp_pic: string | null;
  gender_pic: 'LAKI-LAKI' | 'PEREMPUAN' | null;
  toko: string;
  grup: string | null;
  domain: string | null;
  alamat: string | null;
  daerah: string;
  program: string;
  vb_online: string | null;
  biaya: number;
  tanggal: Date;
  implementator: string | null;
  via: 'VISIT' | 'ONLINE';
  internal_kode: string;
  prev_subscriber: number;
  current_subscriber: number;
  prev_biaya: number;
  current_biaya: number;
  status_aktv: boolean;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const SubscriberSchema: Schema = new Schema({
  kode: { type: String, required: true, unique: true },
  no_ok: { type: String, required: false, default: null },
  nomor_telepon: { type: String, required: false, default: null },
  sales: { type: String, required: false, default: null },
  nama_owner: { type: String, required: false, default: null },
  no_hp_owner: { type: String, required: false, default: null },
  gender_owner: { type: String, required: false, enum: ['LAKI-LAKI', 'PEREMPUAN', null], default: null },
  nama_pic: { type: String, required: false, default: null },
  no_hp_pic: { type: String, required: false, default: null },
  gender_pic: { type: String, required: false, enum: ['LAKI-LAKI', 'PEREMPUAN', null], default: null },
  toko: { type: String, required: true },
  grup: { type: String, required: false, default: null },
  domain: { type: String, required: false, default: null },
  alamat: { type: String, required: false, default: null },
  daerah: { type: String, required: true },
  program: { type: String, required: true },
  vb_online: { type: String, required: false, default: null },
  biaya: { type: Number, required: true, min: 0 },
  tanggal: { type: Date, required: true },
  implementator: { type: String, required: false, default: null },
  via: { type: String, required: true, enum: ['VISIT', 'ONLINE'] },
  internal_kode: { type: String, required: true },
  prev_subscriber: { type: Number, required: true, default: 0 },
  current_subscriber: { type: Number, required: true, default: 1 },
  prev_biaya: { type: Number, required: true, default: 0 },
  current_biaya: { type: Number, required: true, default: 0 },
  status_aktv: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  deleted_at: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
  deleted_by: { type: String, default: null },
});

export default mongoose.model<ISubscriber>('Subscriber', SubscriberSchema, 'tm_subscriber');
