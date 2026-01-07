import mongoose, { Document, Schema } from 'mongoose';

export interface ITTVps extends Document {
  periode: string; // YYYY-MM
  estimasi: number; // sum of total_harga
  realisasi: number; // sum of total_harga where status DONE
  total_toko_estimasi: number; // jumlah detail di periode ini
  total_toko_realisasi: number; // jumlah detail status DONE dan tgl_lunas di periode ini
  updated_at: Date;
  // audit fields (following existing models' convention)
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const TTVpsSchema: Schema = new Schema(
  {
    periode: { type: String, required: true },
    estimasi: { type: Number, required: true, default: 0 },
    realisasi: { type: Number, required: true, default: 0 },
    // total_toko removed
    total_toko_estimasi: { type: Number, required: true, default: 0 },
    total_toko_realisasi: { type: Number, required: true, default: 0 },
    updated_at: { type: Date, default: Date.now },
    input_date: { type: Date, default: Date.now },
    update_date: { type: Date, default: Date.now },
    delete_date: { type: Date, default: null },
    input_by: { type: String, required: true },
    update_by: { type: String, default: null },
    delete_by: { type: String, default: null },
  },
  { minimize: true }
);

TTVpsSchema.index({ periode: 1 }, { unique: true });

export default mongoose.model<ITTVps>('TTVps', TTVpsSchema, 'tt_vps');
