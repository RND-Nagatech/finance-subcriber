import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
  kode_group: string;
  nama_group: string;
  owner: string;
  no_hp: string;
  nama_owner: string | null;
  no_hp_owner: string | null;
  gender_owner: 'LAKI-LAKI' | 'PEREMPUAN' | null;
  nama_pic: string | null;
  no_hp_pic: string | null;
  gender_pic: 'LAKI-LAKI' | 'PEREMPUAN' | null;
  alamat: string | null;
  status_aktv: boolean;
  input_date: Date;
  update_date: Date;
  delete_date: Date | null;
  input_by: string;
  update_by: string | null;
  delete_by: string | null;
}

const GroupSchema: Schema = new Schema({
  kode_group: { type: String, required: true, trim: true, uppercase: true },
  nama_group: { type: String, required: true, trim: true },
  owner: { type: String, required: false, trim: true },
  no_hp: { type: String, required: false, trim: true },
  nama_owner: { type: String, required: false, default: null, trim: true },
  no_hp_owner: { type: String, required: false, default: null, trim: true },
  gender_owner: { type: String, required: false, enum: ['LAKI-LAKI', 'PEREMPUAN', null], default: null },
  nama_pic: { type: String, required: false, default: null, trim: true },
  no_hp_pic: { type: String, required: false, default: null, trim: true },
  gender_pic: { type: String, required: false, enum: ['LAKI-LAKI', 'PEREMPUAN', null], default: null },
  alamat: { type: String, required: false, default: null, trim: true },
  status_aktv: { type: Boolean, default: true },
  input_date: { type: Date, default: Date.now },
  update_date: { type: Date, default: Date.now },
  delete_date: { type: Date, default: null },
  input_by: { type: String, required: true },
  update_by: { type: String, default: null },
  delete_by: { type: String, default: null },
});

GroupSchema.index(
  { kode_group: 1 },
  { unique: true, partialFilterExpression: { delete_date: null } }
);
GroupSchema.index({ nama_group: 1 });
GroupSchema.index({ owner: 1 });
GroupSchema.index({ nama_owner: 1 });
GroupSchema.index({ nama_pic: 1 });

export default mongoose.model<IGroup>('Group', GroupSchema, 'tm_group');
