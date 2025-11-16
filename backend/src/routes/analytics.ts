import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AnalyticsService } from '../services/analytics.service';
import { AnalyticsController } from '../controllers/analytics.controller';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Initialize services and controllers
const analyticsService = new AnalyticsService({} as any);
const analyticsController = new AnalyticsController(analyticsService);

// Middleware to inject supabase client
router.use(authenticate);
router.use((req: AuthRequest, res, next) => {
  if (req.supabaseClient) {
    analyticsService['supabase'] = req.supabaseClient;
  }
  next();
});

router.get('/summary', analyticsController.getSummary);
router.get('/by-league', analyticsController.getByLeague);
router.get('/by-responsible', analyticsController.getByResponsible);
router.get('/time-series', analyticsController.getTimeSeries);

export default router;

