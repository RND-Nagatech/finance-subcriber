import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://robbynugraha:Pr5DG8aQntBxXkHA@cluster0.qxxyqlg.mongodb.net/db_keuangan?retryWrites=true&w=majority";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 100000,
      socketTimeoutMS: 450000,
    });
    console.log("✅ MongoDB connected successfully to:", mongoose.connection.name);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    console.error("📝 Connection URI:", MONGO_URI.replace(/:[^:@]+@/, ':****@'));
    throw err;
  }
};
