import mongoose, { Schema, Document } from 'mongoose';


export interface IRekening extends Document {
  bank_id: mongoose.Types.ObjectId;
  kode_bank: string;
  no_rekening: string;
  nama_rekening: string;
}


const RekeningSchema: Schema = new Schema({
  bank_id: { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  kode_bank: { type: String, required: true, uppercase: true },
  no_rekening: { type: String, required: true, uppercase: true },
  nama_rekening: { type: String, required: true, uppercase: true },
}, { timestamps: true, collection: 'tm_rekening' });

export default mongoose.model<IRekening>('Rekening', RekeningSchema);
