import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { autoSeedIfEmpty } from './utils/auto-seed';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Sistem Absensi Toko Konveksi Backend',
    timestamp: new Date().toISOString(),
  });
});

// Main API Routes
app.use('/api', apiRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Start Server
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 Toko Konveksi Attendance API Server running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
  await autoSeedIfEmpty();
});

export default app;
