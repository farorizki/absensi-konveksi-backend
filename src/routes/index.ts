import { Router } from 'express';
import authRoutes from './auth.routes';
import employeeRoutes from './employee.routes';
import shiftRoutes from './shift.routes';
import attendanceRoutes from './attendance.routes';
import reportRoutes from './report.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/shifts', shiftRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/reports', reportRoutes);

export default router;
