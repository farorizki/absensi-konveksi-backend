import { Router } from 'express';
import {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
} from '../controllers/shift.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticateJwt, getShifts);
router.post('/', authenticateJwt, createShift);
router.put('/:id', authenticateJwt, updateShift);
router.delete('/:id', authenticateJwt, deleteShift);

export default router;
