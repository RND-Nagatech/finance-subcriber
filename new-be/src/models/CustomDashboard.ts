import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomDashboard extends Document {
  title: string;
  sub_kategories: string[]; // array of sub_kategori names
  status_aktv: boolean;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const CustomDashboardSchema: Schema = new Schema({
  title: { type: String, required: true },
  sub_kategories: [{ type: String, required: true }], // array of strings
  status_aktv: { type: Boolean, default: true },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  deleted_at: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
  deleted_by: { type: String, default: null },
  active: { type: Boolean, default: true },
});

export default mongoose.model<ICustomDashboard>('CustomDashboard', CustomDashboardSchema, 'tm_custom_dashboard');