import mongoose, { Document, Schema } from 'mongoose';

export interface IBudget extends Document {
  name: string;
  year: number;
  total_amount: number;
  used_amount: number;
  status_aktv: boolean;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const BudgetSchema: Schema = new Schema({
  name: { type: String, required: true },
  year: { type: Number, required: true },
  total_amount: { type: Number, required: true, default: 0 },
  used_amount: { type: Number, required: true, default: 0 },
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

export default mongoose.model<IBudget>('Budget', BudgetSchema, 'tm_budget');