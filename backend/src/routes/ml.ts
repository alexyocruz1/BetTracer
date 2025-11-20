import { Router } from 'express';
import { mlController } from '../controllers/ml.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/predict', authenticate, mlController.predict);

export default router;
