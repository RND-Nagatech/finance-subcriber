import { connectDB } from './config/db';
import { migrateSubscriberFromCSV } from './scripts/migrate_subscriber';
import { seedKategoriDanSubKategori } from './seed_data';

const runSeed = async () => {
  try {
    console.log('🌱 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected successfully');

    console.log('🌱 Starting seed data process...');
    // await seedKategoriDanSubKategori();
    await migrateSubscriberFromCSV("src/scripts/data_subscriber.csv");
    console.log('✅ Seed data completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

runSeed();