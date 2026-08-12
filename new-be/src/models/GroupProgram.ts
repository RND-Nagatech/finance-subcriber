import mongoose, { Document, Schema } from 'mongoose';

export interface IGroupProgram extends Document {
  group_program: string;
  status_aktv: boolean;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const GroupProgramSchema: Schema = new Schema({
  group_program: { type: String, required: true, unique: true, trim: true },
  status_aktv: { type: Boolean, default: true },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
});

GroupProgramSchema.index({ group_program: 1 });

export default mongoose.model<IGroupProgram>('GroupProgram', GroupProgramSchema, 'tm_group_program');
