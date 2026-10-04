import { Router } from 'express';
import { login, getMe, setupAdmin } from '../controllers/auth.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';

const router = Router();

router.get('/setup', setupAdmin);
router.post('/setup', setupAdmin);
router.post('/login', login);
router.get('/me', authenticateJwt, getMe);

export default router;
