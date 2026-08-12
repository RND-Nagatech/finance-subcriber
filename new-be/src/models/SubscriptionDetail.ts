import mongoose, { Document, Schema } from 'mongoose';

export type SubscriptionDetailStatus = 'OPEN' | 'PROCESS' | 'DONE' | 'BATAL';

export interface ISubscriptionDetail extends Document {
  subscription_id: mongoose.Types.ObjectId | null;
  chain_id: string;
  subscriber_id: mongoose.Types.ObjectId;
  kode_subscriber: string;
  toko: string;
  program: string;
  daerah?: string | null;
  periode: string;
  tahun: number;
  tgl_mulai_tagihan: string;
  jumlah_bulan: number;
  tgl_berakhir_langganan: string;
  tgl_bayar_selanjutnya: string;
  biaya_per_bulan: number;
  jumlah_biaya: number;
  diskon: number;
  total_biaya: number;
  diskon_percent?: number;
  is_active?: boolean;
  status: SubscriptionDetailStatus;
  tgl_lunas: string | null;
  metode_bayar: string | null;
  keterangan: string | null;
  invoice_meta?: {
    invoice_number: string;
    generated_at: Date;
    generated_by: string;
    sender: {
      name: string;
      address: string;
      phone: string;
    };
    customer: {
      name: string;
      address: string;
      phone: string;
    };
    items: Array<{
      program_name: string;
      qty: number;
      unit_price: number;
      line_total: number;
      start_date?: string;
      tempo_date?: string;
    }>;
    subtotal: number;
    discount_rp: number;
    grand_total: number;
    display_date: string;
  };
  doku_payment?: {
    invoice_number: string;
    payment_url: string;
    token_id?: string;
    expired_date?: string;
    amount: number;
    request_id: string;
    generated_at: Date;
    generated_by: string;
    status?: 'PENDING' | 'SUCCESS';
    paid_at?: Date;
    notification_request_id?: string;
    transaction_original_request_id?: string;
    channel_id?: string;
    callback_verified_at?: Date;
    customer?: {
      id?: string;
      name: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
    };
  };
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const SubscriptionDetailSchema: Schema = new Schema({
  subscription_id: { type: Schema.Types.ObjectId, ref: 'Subscription', required: false, default: null },
  chain_id: { type: String, required: true, trim: true },
  subscriber_id: { type: Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  kode_subscriber: { type: String, required: true, trim: true },
  toko: { type: String, required: true, trim: true },
  program: { type: String, required: true, trim: true },
  daerah: { type: String, required: false, default: null, trim: true },
  periode: { type: String, required: true, trim: true },
  tahun: { type: Number, required: true },
  tgl_mulai_tagihan: { type: String, required: true, trim: true },
  jumlah_bulan: { type: Number, required: true, min: 1 },
  tgl_berakhir_langganan: { type: String, required: true, trim: true },
  tgl_bayar_selanjutnya: { type: String, required: true, trim: true },
  biaya_per_bulan: { type: Number, required: true, min: 0 },
  jumlah_biaya: { type: Number, required: true, min: 0 },
  diskon: { type: Number, required: true, min: 0, default: 0 },
  diskon_percent: { type: Number, required: true, min: 0, default: 0 },
  total_biaya: { type: Number, required: true, min: 0 },
  is_active: { type: Boolean, required: true, default: true },
  status: { type: String, enum: ['OPEN', 'PROCESS', 'DONE', 'BATAL'], default: 'OPEN' },
  tgl_lunas: { type: String, required: false, default: null, trim: true },
  metode_bayar: { type: String, required: false, default: null },
  keterangan: { type: String, required: false, default: null },
  invoice_meta: {
    invoice_number: { type: String, required: false },
    generated_at: { type: Date, required: false },
    generated_by: { type: String, required: false },
    sender: {
      name: { type: String, required: false },
      address: { type: String, required: false },
      phone: { type: String, required: false },
    },
    customer: {
      name: { type: String, required: false },
      address: { type: String, required: false },
      phone: { type: String, required: false },
    },
    items: [
      {
        program_name: { type: String, required: false },
        qty: { type: Number, required: false, min: 0 },
        unit_price: { type: Number, required: false, min: 0 },
        line_total: { type: Number, required: false, min: 0 },
        start_date: { type: String, required: false },
        tempo_date: { type: String, required: false },
      },
    ],
    subtotal: { type: Number, required: false, min: 0 },
    discount_rp: { type: Number, required: false, min: 0 },
    discount_percent: { type: Number, required: false, min: 0 },
    discount_label: { type: String, required: false },
    extra_deduction_rp: { type: Number, required: false, min: 0 },
    grand_total: { type: Number, required: false, min: 0 },
    notes: { type: String, required: false },
    display_date: { type: String, required: false },
    payment_accounts: [
      {
        kode_bank: { type: String, required: false },
        no_rekening: { type: String, required: false },
        nama_rekening: { type: String, required: false },
      },
    ],
    pdf_original_url: { type: String, required: false },
    pdf_paid_url: { type: String, required: false },
  },
  doku_payment: {
    invoice_number: { type: String, required: false },
    payment_url: { type: String, required: false },
    token_id: { type: String, required: false },
    expired_date: { type: String, required: false },
    amount: { type: Number, required: false, min: 0 },
    request_id: { type: String, required: false },
    generated_at: { type: Date, required: false },
    generated_by: { type: String, required: false },
    status: { type: String, enum: ['PENDING', 'SUCCESS'], required: false, default: 'PENDING' },
    paid_at: { type: Date, required: false },
    notification_request_id: { type: String, required: false },
    transaction_original_request_id: { type: String, required: false },
    channel_id: { type: String, required: false },
    callback_verified_at: { type: Date, required: false },
    customer: {
      id: { type: String, required: false },
      name: { type: String, required: false },
      phone: { type: String, required: false },
      address: { type: String, required: false },
      city: { type: String, required: false },
      country: { type: String, required: false },
    },
  },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
});

SubscriptionDetailSchema.index({ subscription_id: 1, status: 1 });
SubscriptionDetailSchema.index({ chain_id: 1, status: 1 });
SubscriptionDetailSchema.index({ periode: 1, status: 1 });
SubscriptionDetailSchema.index({ tahun: 1, status: 1 });
SubscriptionDetailSchema.index({ 'invoice_meta.invoice_number': 1 }, { sparse: true });
SubscriptionDetailSchema.index({ 'doku_payment.invoice_number': 1 }, { sparse: true });
SubscriptionDetailSchema.index(
  { chain_id: 1, tgl_mulai_tagihan: 1, delete_date: 1 },
  { unique: true }
);
SubscriptionDetailSchema.index(
  { subscriber_id: 1, tgl_mulai_tagihan: 1, delete_date: 1 },
  { unique: true }
);

export default mongoose.model<ISubscriptionDetail>('SubscriptionDetail', SubscriptionDetailSchema, 'tt_subscription_detail');
