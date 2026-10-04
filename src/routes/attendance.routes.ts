import { Router } from 'express';
import { scanQrCode, getTodayAttendances } from '../controllers/attendance.controller';

const router = Router();

// Endpoint Kios Absensi (Terbuka untuk scanner kiosk tanpa perlu login admin)
router.post('/scan', scanQrCode);
router.get('/today', getTodayAttendances);

export default router;
