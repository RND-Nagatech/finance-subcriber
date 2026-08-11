import mongoose, { Schema, Document } from 'mongoose';

interface IFiscalConfig extends Document {
  key: string;
  active_year: number;
}

const FiscalConfigSchema: Schema = new Schema({
  key: { type: String, default: 'fiscal', unique: true },
  active_year: { type: Number, required: true },
});

export default mongoose.model<IFiscalConfig>('FiscalConfig', FiscalConfigSchema);
