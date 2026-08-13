import mongoose, { Document, Schema } from 'mongoose';

export interface IProgram extends Document {
  nama: string;
  kode: string;
  internal_kode: string;
  biaya: number;
  group_program: string;
  total_subscriber?: number;
  total_biaya_subscriber?: number;
  status_aktv: boolean;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const ProgramSchema: Schema = new Schema({
  nama: { type: String, required: true },
  kode: { type: String, required: true },
  internal_kode: { type: String, required: true },
  biaya: { type: Number, required: true, min: 0 },
    group_program: { type: String, required: true },
    total_subscriber: { type: Number, required: false, default: 0 },
    total_biaya_subscriber: { type: Number, required: false, default: 0 },
  status_aktv: { type: Boolean, default: true },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
});

ProgramSchema.index(
  { nama: 1 },
  { unique: true, partialFilterExpression: { delete_date: null } }
);
ProgramSchema.index(
  { kode: 1 },
  { unique: true, partialFilterExpression: { delete_date: null } }
);

export default mongoose.model<IProgram>('Program', ProgramSchema, 'tm_program');
