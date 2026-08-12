import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriberTahun extends Document {
  subscriber_id: mongoose.Types.ObjectId;
  kode_subscriber: string;
  toko: string;
  kode_group: string | null;
  nama_group: string | null;
  program: string | null;
  status_subscriber: 'OUTSTAND' | 'AKTIF' | 'NON_AKTIF';
  tahun: number;
  total_rencana_tagihan: number;
  tagihan_terbayar: number;
  sisa_tagihan: number;
  last_rebuild_at: Date;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const SubscriberTahunSchema: Schema = new Schema({
  subscriber_id: { type: Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  kode_subscriber: { type: String, required: true, trim: true },
  toko: { type: String, required: true, trim: true },
  kode_group: { type: String, required: false, default: null, trim: true, uppercase: true },
  nama_group: { type: String, required: false, default: null, trim: true },
  program: { type: String, required: false, default: null, trim: true },
  status_subscriber: { type: String, required: true, enum: ['OUTSTAND', 'AKTIF', 'NON_AKTIF'], default: 'AKTIF' },
  tahun: { type: Number, required: true },
  total_rencana_tagihan: { type: Number, required: true, default: 0, min: 0 },
  tagihan_terbayar: { type: Number, required: true, default: 0, min: 0 },
  sisa_tagihan: { type: Number, required: true, default: 0, min: 0 },
  last_rebuild_at: { type: Date, default: Date.now },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
});

SubscriberTahunSchema.index(
  { subscriber_id: 1, tahun: 1, delete_date: 1 },
  { unique: true }
);
SubscriberTahunSchema.index({ tahun: 1 });
SubscriberTahunSchema.index({ kode_group: 1 });
SubscriberTahunSchema.index({ status_subscriber: 1 });

export default mongoose.model<ISubscriberTahun>('SubscriberTahun', SubscriberTahunSchema, 'tt_subscriber_tahun');
