import express from 'express';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import masterRoutes from './routes/masterRoutes';
import fiscalRoutes from './routes/fiscalRoutes';
import subscriberRoutes from './routes/subscriberRoutes';
import vpsRoutes from './routes/vpsRoutes';
import vpsTTRoutes from './routes/vpsTTRoutes';
import userRoutes from './routes/userRoutes';
import { errorLoggerMiddleware } from './middleware/errorLoggerMiddleware';

const app = express();
const PORT = process.env.PORT || 5003;

// CORS configuration
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buffer) => {
    (req as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8');
  },
}));
app.use(morgan('dev'));

// Keep uploads stable even when PM2 starts the process from a different cwd.
const backendUploadsDir = path.resolve(__dirname, '..', 'uploads');
app.use('/uploads', express.static(backendUploadsDir));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`, req.body ? `- Body: ${JSON.stringify(req.body)}` : '');
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    database: 'Connected',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/fiscal', fiscalRoutes);
app.use('/api/subscriber', subscriberRoutes);
app.use('/api/vps', vpsRoutes);
app.use('/api/tt-vps', vpsTTRoutes);
app.use('/api/users', userRoutes);

// Error logging middleware
app.use(errorLoggerMiddleware);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log('=================================');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('=================================');
  });
}).catch(err => {
  console.error('❌ Failed to connect DB', err);
  process.exit(1);
});
