import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import Subscriber from '../models/Subscriber';

async function main() {
  await connectDB();
  const result = await Subscriber.collection.updateMany(
    { active: { $exists: true } },
    { $unset: { active: '' } }
  );
  console.log(`Removed tm_subscriber.active from ${result.modifiedCount} rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
