import { Router } from 'express';
import { mlController } from '../controllers/ml.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/predict', authMiddleware, mlController.predict);

export default router;
