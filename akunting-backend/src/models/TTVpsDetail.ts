import mongoose, { Document, Schema } from 'mongoose';

export type VpsStatus = 'OPEN' | 'PROCESS' | 'DONE';


export interface ITTVpsDetail extends Document {
  periode: string; // YYYY-MM
  chain_id: string;
  toko: string;
  program: string;
  daerah: string;
  start: string; // YYYY-MM-DD
  bulan: number;
  tempo: string; // YYYY-MM-DD
  harga: number;
  jumlah_harga: number;
  diskon: number;
  diskon_percent: number;
  total_harga: number;
  is_active?: boolean;
  status: VpsStatus;
  tgl_lunas?: string;
  keterangan?: string;
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
    discount_percent: number;
    discount_rp: number;
    extra_deduction_rp?: number;
    grand_total: number;
    notes?: string;
    display_date: string;
  };
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const TTVpsDetailSchema: Schema = new Schema(
  {
    periode: { type: String, required: true },
    chain_id: { type: String, required: true },
    toko: { type: String, required: true },
    program: { type: String, required: true },
    daerah: { type: String, required: true },
    start: { type: String, required: true },
    bulan: { type: Number, required: true, min: 1 },
    tempo: { type: String, required: true },
    harga: { type: Number, required: true, min: 0 },
    jumlah_harga: { type: Number, required: true, min: 0 },
    diskon: { type: Number, required: true, min: 0, default: 0 },
    diskon_percent: { type: Number, required: true, min: 0, default: 0 },
    total_harga: { type: Number, required: true, min: 0 },
    is_active: { type: Boolean, required: false, default: true },
    keterangan: { type: String, required: false, default: '-' },
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
      discount_percent: { type: Number, required: false, min: 0, max: 100 },
      discount_rp: { type: Number, required: false, min: 0 },
      extra_deduction_rp: { type: Number, required: false, min: 0, default: 0 },
      grand_total: { type: Number, required: false, min: 0 },
      notes: { type: String, required: false, default: '' },
      display_date: { type: String, required: false },
    },
    status: { type: String, enum: ['OPEN', 'PROCESS', 'DONE'], default: 'OPEN' },
    tgl_lunas: { type: String, required: false },
    input_date: { type: Date, default: Date.now },
    update_date: { type: Date, default: Date.now },
    delete_date: { type: Date, default: null },
    input_by: { type: String, required: true },
    update_by: { type: String, default: null },
    delete_by: { type: String, default: null },
  },
  { minimize: true }
);

TTVpsDetailSchema.index({ periode: 1, chain_id: 1, toko: 1, start: 1 }, { unique: true });

// Additional indexes to optimize common queries
// - by periode (details list, aggregates, last-period)
TTVpsDetailSchema.index({ periode: 1 });
// - by toko with sorting by periode and start (details-by-toko)
TTVpsDetailSchema.index({ toko: 1, periode: 1, start: 1 });
// - by chain_id (remove/resync by chain, maintenance)
TTVpsDetailSchema.index({ chain_id: 1 });
// - by status and tgl_lunas prefix search for realisasi queries
TTVpsDetailSchema.index({ status: 1, tgl_lunas: 1 });
TTVpsDetailSchema.index(
  { 'invoice_meta.invoice_number': 1 },
  { sparse: true }
);

export default mongoose.model<ITTVpsDetail>(
  'TTVpsDetail',
  TTVpsDetailSchema,
  'tt_vps_details'
);
