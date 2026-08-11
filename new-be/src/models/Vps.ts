import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IVpsPeriod {
  month: number; // 0-11
  year: number; // full year
  startDate: Date;
  endDate: Date;
  amount: number;
  paid: boolean;
  paidDate?: Date | null;
}

export interface IVps extends Document {
  subscriber: Types.ObjectId;
  pricePerMonth: number;
  startDate: Date;
  months: number;
  dueDate: Date; // startDate + months - 1 month (same day)
  grossAmount: number; // pricePerMonth * months
  discount: number; // input
  netAmount: number; // grossAmount - discount
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  periods: IVpsPeriod[];
  createdAt: Date;
  updatedAt: Date;
}

const VpsPeriodSchema = new Schema<IVpsPeriod>({
  month: { type: Number, required: true, min: 0, max: 11 },
  year: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0 },
  paid: { type: Boolean, default: false },
  paidDate: { type: Date, default: null },
}, { _id: false });

const VpsSchema = new Schema<IVps>({
  subscriber: { type: Schema.Types.ObjectId, ref: 'Subscriber', required: true, unique: true },
  pricePerMonth: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  months: { type: Number, required: true, min: 1 },
  dueDate: { type: Date, required: true },
  grossAmount: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0, default: 0 },
  netAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' },
  periods: { type: [VpsPeriodSchema], default: [] },
}, { timestamps: true, collection: 'vps_subscriptions' });

export default mongoose.model<IVps>('VpsSubscription', VpsSchema);
