import { Router } from 'express';
import { MLController } from '../controllers/ml.controller';
import { AnalyticsService } from '../services/analytics.service';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Initialize services and controllers
const analyticsService = new AnalyticsService({} as any);
const mlController = new MLController(analyticsService);

// Middleware to inject supabase client
router.use(authenticate);
router.use((req: AuthRequest, _res, next) => {
  if (req.supabaseClient) {
    analyticsService['supabase'] = req.supabaseClient;
  }
  next();
});

router.post('/predict', asyncHandler(mlController.predict));

export default router;
