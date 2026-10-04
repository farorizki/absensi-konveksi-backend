import { Router } from 'express';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeQrCode,
  regenerateQrCode,
} from '../controllers/employee.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticateJwt, getEmployees);
router.post('/', authenticateJwt, createEmployee);
router.get('/:id', authenticateJwt, getEmployeeById);
router.put('/:id', authenticateJwt, updateEmployee);
router.delete('/:id', authenticateJwt, deleteEmployee);

// Endpoint QR Code untuk cetak ID Card
router.get('/:id/qr', authenticateJwt, getEmployeeQrCode);
router.post('/:id/regenerate-qr', authenticateJwt, regenerateQrCode);

export default router;
