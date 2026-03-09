import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceCounter extends Document {
  date_key: string; // YYMMDD
  last_seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceCounterSchema = new Schema<IInvoiceCounter>(
  {
    date_key: { type: String, required: true, unique: true, index: true },
    last_seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IInvoiceCounter>('InvoiceCounter', InvoiceCounterSchema, 'invoice_counters');
