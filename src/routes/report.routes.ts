import { Router } from 'express';
import {
  getDashboardStats,
  getAttendanceRecap,
  exportAttendanceExcel,
  exportAttendancePdf,
} from '../controllers/report.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';

const router = Router();

router.get('/dashboard', authenticateJwt, getDashboardStats);
router.get('/recap', authenticateJwt, getAttendanceRecap);
router.get('/export/excel', authenticateJwt, exportAttendanceExcel);
router.get('/export/pdf', authenticateJwt, exportAttendancePdf);

export default router;
