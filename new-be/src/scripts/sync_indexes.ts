import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import TTVpsDetail from '../models/TTVpsDetail';
import TTVps from '../models/TTVps';
import VpsSubscription from '../models/Vps';
import Subscriber from '../models/Subscriber';

async function run() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await connectDB();
    const connName = mongoose.connection.name;
    console.log(`✅ Connected to database: ${connName}`);

    const tasks = [
      { name: 'tt_vps_details', fn: () => TTVpsDetail.syncIndexes() },
      { name: 'tt_vps', fn: () => TTVps.syncIndexes() },
      { name: 'vps_subscriptions', fn: () => VpsSubscription.syncIndexes() },
      { name: 'tm_subscriber', fn: () => Subscriber.syncIndexes() },
    ];

    for (const t of tasks) {
      console.log(`➡️  Syncing indexes for ${t.name}...`);
      await t.fn();
      console.log(`✅ Indexes synced for ${t.name}`);
    }

    await mongoose.disconnect();
    console.log('🧹 Disconnected. All done.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Failed to sync indexes:', err?.message || err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

run();
