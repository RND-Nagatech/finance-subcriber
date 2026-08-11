import mongoose, { Document, Schema } from 'mongoose';
import { IBudget } from './Budget';

export interface IBudgetUsage extends Document {
  budget_id: mongoose.Types.ObjectId;
  amount_used: number;
  description: string;
  attachment?: string;
  usage_date: Date;
  source_type?: 'MANUAL' | 'TRANSAKSI_VALIDATION';
  source_ref_id?: mongoose.Types.ObjectId | null;
  source_ref_model?: 'TtFinanceDetail' | null;
  reversed_at?: Date | null;
  reversed_by?: string | null;
  status_aktv: boolean;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const BudgetUsageSchema: Schema = new Schema({
  budget_id: { type: Schema.Types.ObjectId, ref: 'Budget', required: true },
  amount_used: { type: Number, required: true },
  description: { type: String, required: true },
  attachment: { type: String, default: null },
  usage_date: { type: Date, required: true },
  source_type: { type: String, enum: ['MANUAL', 'TRANSAKSI_VALIDATION'], default: 'MANUAL' },
  source_ref_id: { type: Schema.Types.ObjectId, ref: 'TtFinanceDetail', default: null },
  source_ref_model: { type: String, enum: ['TtFinanceDetail'], default: null },
  reversed_at: { type: Date, default: null },
  reversed_by: { type: String, default: null },
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

BudgetUsageSchema.index(
  { source_type: 1, source_ref_id: 1, active: 1 },
  {
    unique: true,
    partialFilterExpression: {
      source_type: 'TRANSAKSI_VALIDATION',
      active: true,
    },
  }
);

export default mongoose.model<IBudgetUsage>('BudgetUsage', BudgetUsageSchema, 'tm_budget_usage');
