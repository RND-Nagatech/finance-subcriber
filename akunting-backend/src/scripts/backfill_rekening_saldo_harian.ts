import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import TtFinanceDetail from '../models/TtFinanceDetail';
import RekeningSaldoHarian from '../models/RekeningSaldoHarian';
import {
  applyInputDelta,
  applyValidatedDelta,
  calculateSignedDelta,
  hasValidRekeningKey,
} from '../services/rekeningDailyBalanceService';

type Key = string;

function makeKey(kodeBank: string, noRekening: string) {
  return `${kodeBank}__${noRekening}`;
}

async function run() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await connectDB();
    console.log(`✅ Connected: ${mongoose.connection.name}`);

    console.log('🧹 Clearing existing rekening_saldo_harian...');
    await RekeningSaldoHarian.deleteMany({});

    const cursor = TtFinanceDetail.find({
      status_deleted: { $ne: true },
    })
      .sort({ tanggal: 1, created_at: 1, _id: 1 })
      .cursor();

    let processed = 0;
    let skipped = 0;
    const touched = new Set<Key>();

    for await (const doc of cursor as any) {
      const kodeBank = String(doc.kode_bank || '');
      const noRekening = String(doc.no_rekening || '');
      if (!hasValidRekeningKey(kodeBank, noRekening)) {
        skipped += 1;
        continue;
      }
      if (!doc.tanggal) {
        skipped += 1;
        continue;
      }

      const delta = calculateSignedDelta(String(doc.kategori || ''), Number(doc.nilai || 0));
      await applyInputDelta({
        kode_bank: kodeBank,
        no_rekening: noRekening,
        tanggal: String(doc.tanggal),
        delta,
        countDelta: 1,
      });

      if (doc.is_validated) {
        await applyValidatedDelta({
          kode_bank: kodeBank,
          no_rekening: noRekening,
          tanggal: String(doc.tanggal),
          delta,
          countDelta: 1,
        });
      }

      touched.add(makeKey(kodeBank, noRekening));
      processed += 1;
      if (processed % 200 === 0) {
        console.log(`... processed ${processed} documents`);
      }
    }

    console.log(`✅ Backfill done. processed=${processed}, skipped=${skipped}, rekening=${touched.size}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Backfill gagal:', err?.message || err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

run();

