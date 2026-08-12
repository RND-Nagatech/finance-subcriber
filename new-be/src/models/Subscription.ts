import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscription extends Document {
  periode: string;
  tahun: number;
  estimasi: number;
  realisasi: number;
  total_subscriber_estimasi: number;
  total_subscriber_realisasi: number;
  updated_at: Date;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const SubscriptionSchema: Schema = new Schema({
  periode: { type: String, required: true, trim: true },
  tahun: { type: Number, required: true },
  estimasi: { type: Number, required: true, default: 0, min: 0 },
  realisasi: { type: Number, required: true, default: 0, min: 0 },
  total_subscriber_estimasi: { type: Number, required: true, default: 0, min: 0 },
  total_subscriber_realisasi: { type: Number, required: true, default: 0, min: 0 },
  updated_at: { type: Date, default: Date.now },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
});

SubscriptionSchema.index({ periode: 1 }, { unique: true });
SubscriptionSchema.index({ tahun: 1 });

export default mongoose.model<ISubscription>('Subscription', SubscriptionSchema, 'tt_subscription');
