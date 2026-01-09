import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import TTVpsDetail from '../models/TTVpsDetail';
import TTVps from '../models/TTVps';

type GroupKey = { periode: string; chain_id: string; toko: string; start: string };

function sum(arr: number[]): number { return arr.reduce((a, b) => a + b, 0); }

async function recalcAggregateForPeriode(periode: string) {
  const detailsDocsPerPeriod = await TTVpsDetail.find({ periode });
  const computedEstimasi = detailsDocsPerPeriod.reduce((acc, d) => acc + (d.total_harga || 0), 0);
  const realisasiDocs = await TTVpsDetail.find({ status: 'DONE', tgl_lunas: { $regex: `^${periode}` } });
  const computedRealisasi = realisasiDocs.reduce((acc, d) => acc + (d.total_harga || 0), 0);
  const computedTotalTokoEstimasi = detailsDocsPerPeriod.length;
  const computedTotalTokoRealisasi = realisasiDocs.length;

  await TTVps.updateOne(
    { periode },
    {
      $set: {
        estimasi: computedEstimasi,
        realisasi: computedRealisasi,
        total_toko_estimasi: computedTotalTokoEstimasi,
        total_toko_realisasi: computedTotalTokoRealisasi,
        update_date: new Date(),
      },
      $setOnInsert: {
        input_date: new Date(),
      },
    },
    { upsert: true }
  );
}

async function run() {
  const args = process.argv.slice(2);
  const FIX = args.includes('--fix');
  try {
    console.log('🔧 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Connected');

    console.log('🔎 Scanning for duplicates in tt_vps_details...');
    const dupGroups = await TTVpsDetail.aggregate([
      {
        $group: {
          _id: { periode: '$periode', chain_id: '$chain_id', toko: '$toko', start: '$start' },
          ids: { $push: '$_id' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { 'count': -1 } },
    ]);

    if (!dupGroups.length) {
      console.log('✅ No duplicates found. Nothing to do.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`⚠️  Found ${dupGroups.length} duplicate groups.`);
    if (!FIX) {
      console.log('ℹ️  Dry-run mode. Use --fix to remove duplicates. Showing up to 5 groups:');
      for (const g of dupGroups.slice(0, 5)) {
        const key = g._id as GroupKey;
        console.log(` - periode=${key.periode} chain_id=${key.chain_id} toko=${key.toko} start=${key.start} (count=${g.count})`);
      }
      await mongoose.disconnect();
      process.exit(0);
    }

    const affectedPeriodes = new Set<string>();
    let removed = 0;
    for (const g of dupGroups) {
      const key = g._id as GroupKey;
      const ids: mongoose.Types.ObjectId[] = g.ids;
      // Load docs to decide which one to keep
      const docs = await TTVpsDetail.find({ _id: { $in: ids } }).lean();
      // Keep the newest by update_date, fallback input_date, fallback _id
      const sorted = docs.sort((a: any, b: any) => {
        const aU = new Date(a.update_date || 0).getTime();
        const bU = new Date(b.update_date || 0).getTime();
        if (aU !== bU) return bU - aU;
        const aI = new Date(a.input_date || 0).getTime();
        const bI = new Date(b.input_date || 0).getTime();
        if (aI !== bI) return bI - aI;
        return String(b._id).localeCompare(String(a._id));
      });
      const keep = sorted[0];
      const removeIds = sorted.slice(1).map((d: any) => d._id);
      if (removeIds.length) {
        await TTVpsDetail.deleteMany({ _id: { $in: removeIds } });
        removed += removeIds.length;
        affectedPeriodes.add(key.periode);
        console.log(`🗑️  Removed ${removeIds.length} duplicates for toko=${key.toko} periode=${key.periode} start=${key.start}`);
      }
    }

    console.log(`✅ Removed ${removed} duplicate documents. Recalculating aggregates for affected periodes...`);
    for (const p of affectedPeriodes) {
      await recalcAggregateForPeriode(p);
    }

    await mongoose.disconnect();
    console.log('🎉 Done. You can now run your index sync again.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Dedupe failed:', err?.message || err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

run();
