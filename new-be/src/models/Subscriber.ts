import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriber extends Document {
  kode: string;
  group_id: mongoose.Types.ObjectId | null;
  kode_group: string | null;
  nama_group: string | null;
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
  server_location: string | null;
  alamat: string | null;
  daerah: string;
  program: string;
  vb_online: string | null;
  biaya: number;
  tanggal: string | null;
  tgl_implementasi: string | null;
  tgl_dijalankan: string | null;
  tgl_terbayar: string | null;
  tgl_berakhir_langganan: string | null;
  tgl_bayar_selanjutnya: string | null;
  implementator: string | null;
  via: 'VISIT' | 'ONLINE';
  internal_kode: string;
  prev_subscriber: number;
  current_subscriber: number;
  prev_biaya: number;
  current_biaya: number;
  status_subscriber: 'OUTSTAND' | 'AKTIF' | 'NON_AKTIF';
  tgl_non_aktif: string | null;
  alasan_non_aktif: string | null;
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
  group_id: { type: Schema.Types.ObjectId, ref: 'Group', required: false, default: null },
  kode_group: { type: String, required: false, default: null, trim: true, uppercase: true },
  nama_group: { type: String, required: false, default: null, trim: true },
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
  server_location: { type: String, required: false, default: null, trim: true },
  alamat: { type: String, required: false, default: null },
  daerah: { type: String, required: true },
  program: { type: String, required: true },
  vb_online: { type: String, required: false, default: null },
  biaya: { type: Number, required: true, min: 0 },
  tanggal: { type: String, required: false, default: null, trim: true },
  tgl_implementasi: { type: String, required: false, default: null, trim: true },
  tgl_dijalankan: { type: String, required: false, default: null, trim: true },
  tgl_terbayar: { type: String, required: false, default: null, trim: true },
  tgl_berakhir_langganan: { type: String, required: false, default: null, trim: true },
  tgl_bayar_selanjutnya: { type: String, required: false, default: null, trim: true },
  implementator: { type: String, required: false, default: null },
  via: { type: String, required: true, enum: ['VISIT', 'ONLINE'] },
  internal_kode: { type: String, required: true },
  prev_subscriber: { type: Number, required: true, default: 0 },
  current_subscriber: { type: Number, required: true, default: 1 },
  prev_biaya: { type: Number, required: true, default: 0 },
  current_biaya: { type: Number, required: true, default: 0 },
  status_subscriber: { type: String, required: true, enum: ['OUTSTAND', 'AKTIF', 'NON_AKTIF'], default: 'AKTIF' },
  tgl_non_aktif: { type: String, required: false, default: null, trim: true },
  alasan_non_aktif: { type: String, required: false, default: null, trim: true },
  status_aktv: { type: Boolean, default: true },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  deleted_at: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
  deleted_by: { type: String, default: null },
});

SubscriberSchema.index({ group_id: 1 });
SubscriberSchema.index({ kode_group: 1 });
SubscriberSchema.index({ server_location: 1 });
SubscriberSchema.index({ status_subscriber: 1 });

export default mongoose.model<ISubscriber>('Subscriber', SubscriberSchema, 'tm_subscriber');
