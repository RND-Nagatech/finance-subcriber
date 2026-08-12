import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import Subscriber from '../models/Subscriber';
import SubscriptionDetail from '../models/SubscriptionDetail';

async function main() {
  await connectDB();

  const subscriberIds = await SubscriptionDetail.distinct('subscriber_id', {
    delete_date: null,
  });

  let updated = 0;
  for (const subscriberId of subscriberIds) {
    const latestDone: any = await SubscriptionDetail.findOne({
      subscriber_id: subscriberId,
      status: 'DONE',
      delete_date: null,
    }).sort({ tgl_mulai_tagihan: -1 });

    await Subscriber.findByIdAndUpdate(subscriberId, {
      tgl_terbayar: latestDone?.tgl_mulai_tagihan || null,
      tgl_berakhir_langganan: latestDone?.tgl_berakhir_langganan || null,
      tgl_bayar_selanjutnya: latestDone?.tgl_bayar_selanjutnya || null,
      update_date: new Date(),
      update_by: 'sync_subscriber_payment_dates',
    });
    updated += 1;
  }

  console.log(`Synced subscriber payment dates: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
