import mongoose from 'mongoose';
import Rekening from '../models/Rekening';

const addSaldoToRekening = async () => {
  try {
    console.log('Starting migration: Add saldo field to rekening collection');

    // Update all existing rekening documents to have saldo field with default value 0
    const result = await Rekening.updateMany(
      { saldo: { $exists: false } },
      { $set: { saldo: 0 } }
    );

    console.log(`Migration completed: ${result.modifiedCount} rekening documents updated`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

export default addSaldoToRekening;