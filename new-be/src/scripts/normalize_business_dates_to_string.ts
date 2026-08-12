import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import Subscriber from '../models/Subscriber';
import SubscriptionDetail from '../models/SubscriptionDetail';

const toYMD = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

async function normalizeCollection(model: any, fields: string[]) {
  const rows = await model.find({});
  let updated = 0;
  for (const row of rows) {
    let changed = false;
    for (const field of fields) {
      const value = row.get(field);
      const normalized = toYMD(value);
      if (normalized !== null && value !== normalized) {
        row.set(field, normalized);
        changed = true;
      }
    }
    if (changed) {
      await row.save();
      updated += 1;
    }
  }
  return updated;
}

async function main() {
  await connectDB();

  const subscriberUpdated = await normalizeCollection(Subscriber, [
    'tanggal',
    'tgl_implementasi',
    'tgl_dijalankan',
    'tgl_terbayar',
    'tgl_berakhir_langganan',
    'tgl_bayar_selanjutnya',
  ]);

  const detailUpdated = await normalizeCollection(SubscriptionDetail, [
    'tgl_mulai_tagihan',
    'tgl_berakhir_langganan',
    'tgl_bayar_selanjutnya',
    'tgl_lunas',
  ]);

  console.log(`Normalized subscriber rows: ${subscriberUpdated}`);
  console.log(`Normalized subscription detail rows: ${detailUpdated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
